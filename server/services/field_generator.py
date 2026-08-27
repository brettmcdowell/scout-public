"""Field boundary detection using DelineateAnything (YOLOv11).

Fetches Esri satellite tiles, runs instance segmentation, returns GeoJSON.
Uses the DelineateAnything-S model directly via ultralytics, bypassing the
ftw wrapper to avoid version compatibility issues.
"""
import io
import string

import mercantile
import pandas as pd
import requests
import numpy as np
import geopandas as gpd
import shapely.geometry
import shapely.ops
from PIL import Image
from rasterio.transform import from_bounds
from rasterio.crs import CRS
from pyproj import Geod

from models.schemas import (
    BoundingBox,
    Coordinates,
    FieldCollection,
    FieldFeature,
    FieldGeometry,
    FieldProperties,
)

geod = Geod(ellps="WGS84")

ESRI_TILE_URL = (
    "https://server.arcgisonline.com/ArcGIS/rest/services/"
    "World_Imagery/MapServer/tile/{z}/{y}/{x}"
)

MODEL_URL = "https://hf.co/torchgeo/delineate-anything/resolve/60bea7b2f81568d16d5c75e4b5b06289e1d7efaf/delineate_anything_rgb_yolo11x-88ede029.pt"

# Lazy-loaded model singleton
_model = None


def _get_model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO(MODEL_URL)
        _model.to("cpu")
    return _model


def _fetch_mosaic(bbox: BoundingBox, zoom: int = 17):
    """Fetch Esri tiles, return (numpy HWC uint8 array, rasterio Affine transform)."""
    tiles = list(mercantile.tiles(bbox.west, bbox.south, bbox.east, bbox.north, zoom))
    if not tiles:
        raise ValueError("No tiles for bounding box")

    xs = sorted(set(t.x for t in tiles))
    ys = sorted(set(t.y for t in tiles))
    tile_size = 256
    w, h = len(xs) * tile_size, len(ys) * tile_size

    mosaic = Image.new("RGB", (w, h))
    x_min, y_min = xs[0], ys[0]

    for tile in tiles:
        url = ESRI_TILE_URL.format(z=tile.z, y=tile.y, x=tile.x)
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        mosaic.paste(Image.open(io.BytesIO(resp.content)),
                     ((tile.x - x_min) * tile_size, (tile.y - y_min) * tile_size))

    tl = mercantile.bounds(mercantile.Tile(xs[0], ys[0], zoom))
    br = mercantile.bounds(mercantile.Tile(xs[-1], ys[-1], zoom))
    transform = from_bounds(tl.west, br.south, br.east, tl.north, w, h)

    return np.array(mosaic), transform


def _polygonize_result(result, transform, crs):
    """Convert YOLO segmentation result to georeferenced GeoDataFrame."""
    def pixel_to_geo(x, y, z=None):
        return transform * (x, y)

    df = result.to_df()
    # to_df() may return polars or pandas — normalize to pandas
    if hasattr(df, 'to_pandas'):
        df = df.to_pandas()
    if "segments" not in df.columns or len(df) == 0:
        return gpd.GeoDataFrame()

    df["geometry"] = df["segments"].apply(
        lambda s: shapely.geometry.Polygon(zip(s["x"], s["y"]))
    )
    df["geometry"] = df["geometry"].apply(
        lambda geom: shapely.ops.transform(pixel_to_geo, geom)
    )
    return gpd.GeoDataFrame(df, geometry="geometry", crs=crs)


def _merge_overlapping(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Merge overlapping detections following the paper's approach.

    Process fields largest-first.  When a smaller field's intersection with a
    larger one exceeds 50% of the smaller field's area, drop the smaller one.
    """
    if gdf.empty:
        return gdf

    gdf = gdf.copy()
    # Fix invalid geometries before any spatial ops
    gdf["geometry"] = gdf["geometry"].apply(
        lambda g: g.buffer(0) if not g.is_valid else g
    )
    gdf["_area"] = gdf.geometry.area
    gdf = gdf.sort_values("_area", ascending=False).reset_index(drop=True)

    drop = set()
    sindex = gdf.sindex

    for i in range(len(gdf)):
        if i in drop:
            continue
        geom_i = gdf.at[i, "geometry"]
        candidates = list(sindex.intersection(geom_i.bounds))
        for j in candidates:
            if j <= i or j in drop:
                continue
            geom_j = gdf.at[j, "geometry"]
            try:
                if not geom_i.intersects(geom_j):
                    continue
                inter_area = geom_i.intersection(geom_j).area
            except Exception:
                continue
            if geom_j.area > 0 and inter_area / geom_j.area > 0.3:
                drop.add(j)

    gdf = gdf.drop(index=list(drop)).reset_index(drop=True)
    gdf = gdf.drop(columns=["_area"], errors="ignore")
    return gdf


def _gdf_to_field_collection(gdf: gpd.GeoDataFrame) -> FieldCollection:
    """Convert detected polygons to FieldCollection."""
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    features: list[FieldFeature] = []
    names = list(string.ascii_uppercase)

    for _, row in gdf.iterrows():
        geom = row.geometry
        if not geom.is_valid:
            geom = geom.buffer(0)
        polys = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]

        for poly in polys:
            # Compute area/perimeter from full-resolution geometry
            raw_coords = list(poly.exterior.coords)
            lngs = [c[0] for c in raw_coords]
            lats = [c[1] for c in raw_coords]
            area, perimeter = geod.polygon_area_perimeter(lngs, lats)
            ha = abs(area) / 10000

            if ha < 0.25:  # paper uses 2500 m² minimum
                continue

            # Douglas-Peucker simplification (~5m tolerance at UK latitudes)
            simplified = poly.simplify(0.00005, preserve_topology=True)
            coords = list(simplified.exterior.coords)

            idx = len(features)
            features.append(FieldFeature(
                id=f"field-{idx + 1:03d}",
                properties=FieldProperties(
                    name=f"Field {names[idx % 26]}",
                    area_hectares=round(ha, 1),
                    perimeter_m=round(abs(perimeter), 0),
                ),
                geometry=FieldGeometry(coordinates=[[[c[0], c[1]] for c in coords]]),
            ))

    return FieldCollection(features=features)


def generate_fields(bbox: BoundingBox, center: Coordinates) -> FieldCollection:
    """Detect field boundaries in satellite imagery.

    Fetches the full satellite mosaic and runs DelineateAnything on it in one
    pass.  YOLO handles letterbox-resizing to imgsz internally, so passing the
    full image gives the model maximum context for field detection.
    """
    arr, transform = _fetch_mosaic(bbox, zoom=17)
    crs = CRS.from_epsg(4326)

    model = _get_model()
    results = model.predict(
        arr,
        imgsz=1024,
        conf=0.005,
        max_det=500,
        iou=0.6,
        device="cpu",
        retina_masks=True,
        verbose=False,
    )

    gdfs = []
    for result in results:
        if result.masks is not None and len(result.masks) > 0:
            gdf = _polygonize_result(result, transform, crs)
            if not gdf.empty:
                gdfs.append(gdf)

    if not gdfs:
        return FieldCollection(features=[])

    merged = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True))
    merged = _merge_overlapping(merged)
    return _gdf_to_field_collection(merged)
