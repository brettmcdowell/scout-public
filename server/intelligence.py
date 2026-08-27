"""Field intelligence analysis.

Primary: real NDVI/NDRE from Sentinel-2 L2A via Element 84 Earth Search STAC API.
Fallback: VARI/ExGI vegetation indices computed from Esri RGB satellite tiles.

Both paths return geo-referenced RGBA PNGs clipped to the field polygon, so only
the field shape is coloured and the satellite basemap shows through elsewhere.
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import io
import base64

router = APIRouter(prefix="/api/intelligence")


class GeoJSONGeometry(BaseModel):
    type: str
    coordinates: list


class FieldFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: dict


# ---------------------------------------------------------------------------
# Polygon masking (shared by both data paths)
# ---------------------------------------------------------------------------

def _poly_mask(ring_coords: list, w: int, h: int,
               west: float, south: float, east: float, north: float) -> np.ndarray:
    """Rasterise polygon outer ring to boolean mask (True = inside field)."""
    def to_px(lng, lat):
        return (
            int((lng - west) / (east - west) * w),
            int((north - lat) / (north - south) * h),
        )

    pixels = [to_px(lng, lat) for lng, lat in ring_coords]
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).polygon(pixels, fill=255)
    return np.array(img) > 0


# ---------------------------------------------------------------------------
# Path A — Sentinel-2 NDVI via Element 84 Earth Search STAC
# ---------------------------------------------------------------------------

STAC_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"


def _fetch_sentinel2(min_lng: float, min_lat: float, max_lng: float, max_lat: float,
                     target_date: Optional[str] = None):
    """Fetch real NDVI and NDRE arrays from Sentinel-2 L2A.

    Searches Element 84 Earth Search, iterating candidate scenes and using the
    SCL (Scene Classification Layer) to find one where the field pixels are
    actually cloud-free (scene-level cloud% is unreliable for small fields).

    Applies the S2 L2A processing-baseline-4 offset correction:
        physical_reflectance = raw * 0.0001 - 0.1

    Returns: (ndvi, ndre, west, south, east, north)  — all arrays in WGS84.
    Raises if no suitable imagery is found or COG read fails.
    """
    import requests as _requests
    import rasterio
    from rasterio.crs import CRS
    from rasterio.warp import transform_bounds, reproject, calculate_default_transform, Resampling
    from rasterio.windows import from_bounds as window_from_bounds
    from rasterio.env import Env
    from datetime import datetime, timedelta

    wgs84 = CRS.from_epsg(4326)
    # Add a small buffer so that after reprojection to WGS84 the edge pixels
    # of the field are fully covered (tight bbox → edge NaNs after warp).
    buf = 0.0002   # ~20 m ≈ 2 S2 pixels; enough for bilinear reproject fringe
    bbox_4326 = (min_lng - buf, min_lat - buf, max_lng + buf, max_lat + buf)

    # ── 1. Search STAC ──────────────────────────────────────────────────────
    if target_date:
        dt = datetime.strptime(target_date, '%Y-%m-%d')
        start = (dt - timedelta(days=4)).strftime('%Y-%m-%dT00:00:00Z')
        end = (dt + timedelta(days=4)).strftime('%Y-%m-%dT23:59:59Z')
    else:
        end_dt = datetime.utcnow()
        start = (end_dt - timedelta(days=120)).strftime('%Y-%m-%dT00:00:00Z')
        end = end_dt.strftime('%Y-%m-%dT23:59:59Z')

    resp = _requests.post(STAC_SEARCH_URL, json={
        "collections": ["sentinel-2-l2a"],
        "bbox": [min_lng, min_lat, max_lng, max_lat],
        "datetime": f"{start}/{end}",
        "query": {"eo:cloud_cover": {"lt": 90}},
        "limit": 15,
    }, timeout=20)
    resp.raise_for_status()

    items = resp.json().get("features", [])
    if not items:
        raise ValueError("No Sentinel-2 imagery found for this area and time range")

    # Sort: if target_date requested, prefer closest date; otherwise least cloudy
    if target_date:
        dt_target = datetime.strptime(target_date, '%Y-%m-%d')
        items.sort(key=lambda i: abs(
            (datetime.strptime(i["properties"]["datetime"][:10], '%Y-%m-%d') - dt_target).days
        ))
    else:
        items.sort(key=lambda i: i.get("properties", {}).get("eo:cloud_cover", 999))

    def _href(assets, keys):
        for k in keys:
            if k in assets and "href" in assets[k]:
                return assets[k]["href"]
        return None

    # SCL classes treated as usable surface pixels:
    #   3 = cloud shadow (included — real surface, just attenuated; excluding it
    #       leaves visible holes in the field overlay)
    #   4 = vegetation, 5 = bare soil, 6 = water, 7 = unclassified
    GOOD_SCL = [3, 4, 5, 6, 7]

    # ── 2. Pick first scene where field pixels are actually clear (SCL check) ─
    def _read_window(href, shape=None):
        """Read a COG window; returns (float32 array, transform, crs, bounds)."""
        with Env(GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
            with rasterio.open(href) as src:
                src_crs = src.crs
                if src_crs.to_epsg() != 4326:
                    bbox_native = transform_bounds(wgs84, src_crs, *bbox_4326)
                else:
                    bbox_native = bbox_4326
                window = window_from_bounds(*bbox_native, transform=src.transform)
                if shape:
                    data = src.read(1, window=window, out_shape=shape,
                                    resampling=Resampling.bilinear).astype(np.float32)
                else:
                    data = src.read(1, window=window).astype(np.float32)
                win_t = src.window_transform(window)
                h, w = data.shape
                bounds = rasterio.transform.array_bounds(h, w, win_t)
                return data, win_t, src_crs, bounds

    selected = None
    for item in items:
        assets = item["assets"]
        scl_href = _href(assets, ["scl", "SCL"])
        if not scl_href:
            selected = item
            break
        try:
            scl, _, scl_crs, _ = _read_window(scl_href)
            good_pct = np.isin(scl.astype(int), GOOD_SCL).mean()
            if good_pct >= 0.40:   # at least 40% of field pixels are clear
                selected = item
                break
        except Exception:
            continue

    if selected is None:
        raise ValueError("No cloud-free Sentinel-2 scene found for this field")

    assets = selected["assets"]
    actual_date = selected["properties"]["datetime"][:10]
    b04_href = _href(assets, ["red", "B04"])
    b08_href = _href(assets, ["nir", "B08", "nir-wide"])
    b05_href = _href(assets, ["rededge1", "B05"])
    b8a_href = _href(assets, ["nir08", "B8A"])
    b02_href = _href(assets, ["blue", "B02"])
    b03_href = _href(assets, ["green", "B03"])
    b11_href = _href(assets, ["swir16", "B11"])
    scl_href = _href(assets, ["scl", "SCL"])
    vis_href = _href(assets, ["visual"])

    if not (b04_href and b08_href):
        raise ValueError("Required bands not available in STAC item")

    # ── 3. Read bands at native resolution ────────────────────────────────────
    b04_raw, b04_transform, src_crs, native_bounds = _read_window(b04_href)
    mh, mw = b04_raw.shape
    b08_raw, _, _, _ = _read_window(b08_href, shape=(mh, mw))

    # Optional bands for EVI (B02), NDWI (B03), NDMI (B11/SWIR1)
    b02_raw = None
    b03_raw = None
    b11_raw = None
    if b02_href:
        try:
            b02_raw, _, _, _ = _read_window(b02_href, shape=(mh, mw))
        except Exception:
            pass
    if b03_href:
        try:
            b03_raw, _, _, _ = _read_window(b03_href, shape=(mh, mw))
        except Exception:
            pass
    if b11_href:
        try:
            b11_raw, _, _, _ = _read_window(b11_href, shape=(mh, mw))
        except Exception:
            pass

    # Build cloud mask from SCL (True = good pixel)
    if scl_href:
        try:
            scl, _, _, _ = _read_window(scl_href, shape=(mh, mw))
            clear_mask = np.isin(scl.astype(int), GOOD_SCL)
        except Exception:
            clear_mask = np.ones((mh, mw), dtype=bool)
    else:
        clear_mask = np.ones((mh, mw), dtype=bool)

    # Raw values from Element84 COGs are already 0-10000 reflectance scale.
    # Nodata = 0; mask those + cloud pixels as NaN → render transparent.
    valid_b04 = (b04_raw > 0) & clear_mask
    valid_b08 = (b08_raw > 0) & clear_mask
    b04 = np.where(valid_b04, b04_raw, np.nan).astype(np.float32)
    b08 = np.where(valid_b08, b08_raw, np.nan).astype(np.float32)

    denom = b08 + b04
    ndvi_native = np.where(np.isfinite(denom) & (denom > 0),
                           np.clip((b08 - b04) / denom, -1.0, 1.0),
                           np.nan).astype(np.float32)

    if b05_href and b8a_href:
        b05_raw, _, _, _ = _read_window(b05_href, shape=(mh, mw))
        b8a_raw, _, _, _ = _read_window(b8a_href, shape=(mh, mw))
        b05 = np.where((b05_raw > 0) & clear_mask, b05_raw, np.nan).astype(np.float32)
        b8a = np.where((b8a_raw > 0) & clear_mask, b8a_raw, np.nan).astype(np.float32)
        denom_re = b8a + b05
        ndre_native = np.where(np.isfinite(denom_re) & (denom_re > 0),
                               np.clip((b8a - b05) / denom_re, -1.0, 1.0),
                               np.nan).astype(np.float32)
    else:
        ndre_native = np.where(np.isfinite(ndvi_native),
                               np.clip(ndvi_native * 0.82 + 0.08, -1.0, 1.0),
                               np.nan).astype(np.float32)

    # EVI = 2.5*(NIR-Red)/(NIR+6*Red-7.5*Blue+10000); +10000 because bands are 0-10000 scale
    evi_native = None
    if b02_raw is not None:
        b02 = np.where((b02_raw > 0) & clear_mask, b02_raw, np.nan).astype(np.float32)
        evi_denom = b08 + 6.0 * b04 - 7.5 * b02 + 10000.0
        evi_native = np.where(np.isfinite(evi_denom) & (evi_denom > 0),
                              np.clip(2.5 * (b08 - b04) / evi_denom, -1.0, 1.0),
                              np.nan).astype(np.float32)

    # NDWI (McFeeters) = (Green-NIR)/(Green+NIR); positive values indicate surface water
    ndwi_native = None
    if b03_raw is not None:
        b03 = np.where((b03_raw > 0) & clear_mask, b03_raw, np.nan).astype(np.float32)
        ndwi_denom = b03 + b08
        ndwi_native = np.where(np.isfinite(ndwi_denom) & (ndwi_denom > 0),
                               np.clip((b03 - b08) / ndwi_denom, -1.0, 1.0),
                               np.nan).astype(np.float32)

    # NDMI = (NIR-SWIR1)/(NIR+SWIR1); positive values indicate vegetation moisture
    ndmi_native = None
    if b11_raw is not None:
        b11 = np.where((b11_raw > 0) & clear_mask, b11_raw, np.nan).astype(np.float32)
        ndmi_denom = b08 + b11
        ndmi_native = np.where(np.isfinite(ndmi_denom) & (ndmi_denom > 0),
                               np.clip((b08 - b11) / ndmi_denom, -1.0, 1.0),
                               np.nan).astype(np.float32)

    # ── 4. Warp to WGS84 ────────────────────────────────────────────────────
    def _warp_to_wgs84(arr, src_transform, src_crs):
        dst_transform, dst_w, dst_h = calculate_default_transform(
            src_crs, wgs84, mw, mh, *native_bounds
        )
        out = np.full((dst_h, dst_w), np.nan, dtype=np.float32)
        reproject(
            arr, out,
            src_transform=src_transform,
            src_crs=src_crs,
            dst_transform=dst_transform,
            dst_crs=wgs84,
            resampling=Resampling.bilinear,
            src_nodata=np.nan,
            dst_nodata=np.nan,
        )
        out_bounds = rasterio.transform.array_bounds(dst_h, dst_w, dst_transform)
        return out, out_bounds

    ndvi_wgs84, wgs84_bounds = _warp_to_wgs84(ndvi_native, b04_transform, src_crs)
    ndre_wgs84, _ = _warp_to_wgs84(ndre_native, b04_transform, src_crs)
    evi_wgs84 = _warp_to_wgs84(evi_native, b04_transform, src_crs)[0] if evi_native is not None else None
    ndwi_wgs84 = _warp_to_wgs84(ndwi_native, b04_transform, src_crs)[0] if ndwi_native is not None else None
    ndmi_wgs84 = _warp_to_wgs84(ndmi_native, b04_transform, src_crs)[0] if ndmi_native is not None else None

    # ── 5. True-colour RGB from visual/TCI band ──────────────────────────────
    rgb_wgs84 = None
    if vis_href:
        try:
            with Env(GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
                with rasterio.open(vis_href) as src:
                    vis_crs = src.crs
                    if vis_crs.to_epsg() != 4326:
                        bbox_vis = transform_bounds(wgs84, vis_crs, *bbox_4326)
                    else:
                        bbox_vis = bbox_4326
                    win = window_from_bounds(*bbox_vis, transform=src.transform)
                    rgb = src.read([1, 2, 3], window=win)  # (3, h, w) uint8
            # Warp each channel to WGS84
            west, south, east, north = wgs84_bounds
            vis_t = src.window_transform(win)  # approximate; fine for display
            def _warp_rgb_ch(ch):
                dst_t, dw, dh = calculate_default_transform(vis_crs, wgs84, rgb.shape[2], rgb.shape[1], *transform_bounds(wgs84, vis_crs, *bbox_4326))
                out = np.zeros((dh, dw), dtype=np.float32)
                reproject(ch.astype(np.float32), out, src_transform=vis_t, src_crs=vis_crs,
                          dst_transform=dst_t, dst_crs=wgs84, resampling=Resampling.bilinear)
                return out
            r_w = _warp_rgb_ch(rgb[0])
            g_w = _warp_rgb_ch(rgb[1])
            b_w = _warp_rgb_ch(rgb[2])
            rgb_wgs84 = np.stack([r_w, g_w, b_w], axis=-1).astype(np.uint8)
        except Exception:
            rgb_wgs84 = None

    west, south, east, north = wgs84_bounds
    return ndvi_wgs84, ndre_wgs84, ndmi_wgs84, evi_wgs84, ndwi_wgs84, rgb_wgs84, west, south, east, north, actual_date


# ---------------------------------------------------------------------------
# Path B — VARI / ExGI from Esri RGB tiles (fallback)
# ---------------------------------------------------------------------------

ESRI_TILE_URL = (
    "https://server.arcgisonline.com/ArcGIS/rest/services/"
    "World_Imagery/MapServer/tile/{z}/{y}/{x}"
)


def _fetch_esri_mosaic(min_lng: float, min_lat: float, max_lng: float, max_lat: float, zoom: int = 17):
    """Fetch Esri satellite tiles. Drops to zoom-1 if tile count > 25."""
    import mercantile, requests as _requests

    tiles = list(mercantile.tiles(min_lng, min_lat, max_lng, max_lat, zoom))
    if len(tiles) > 25:
        zoom -= 1
        tiles = list(mercantile.tiles(min_lng, min_lat, max_lng, max_lat, zoom))
    if not tiles:
        raise ValueError("No tiles for bounding box")

    xs = sorted(set(t.x for t in tiles))
    ys = sorted(set(t.y for t in tiles))
    tile_sz = 256
    mosaic = Image.new("RGB", (len(xs) * tile_sz, len(ys) * tile_sz))
    x0 = xs[0]

    for tile in tiles:
        url = ESRI_TILE_URL.format(z=tile.z, y=tile.y, x=tile.x)
        resp = _requests.get(url, timeout=10)
        resp.raise_for_status()
        mosaic.paste(
            Image.open(io.BytesIO(resp.content)),
            ((tile.x - x0) * tile_sz, (tile.y - ys[0]) * tile_sz),
        )

    tl = mercantile.bounds(mercantile.Tile(xs[0], ys[0], zoom))
    br = mercantile.bounds(mercantile.Tile(xs[-1], ys[-1], zoom))
    return np.array(mosaic), tl.west, br.south, br.east, tl.north


def _vari(rgb: np.ndarray) -> np.ndarray:
    """VARI = (G - R) / (G + R - B). Range ~-1 to 1."""
    R, G, B = rgb[:, :, 0].astype(float), rgb[:, :, 1].astype(float), rgb[:, :, 2].astype(float)
    d = G + R - B
    d[np.abs(d) < 1] = 1
    return np.clip((G - R) / d, -1.0, 1.0)


def _exgi(rgb: np.ndarray) -> np.ndarray:
    """ExGI = (2G - R - B) / 255, normalised to [-1, 1]."""
    R, G, B = rgb[:, :, 0].astype(float), rgb[:, :, 1].astype(float), rgb[:, :, 2].astype(float)
    return np.clip((2 * G - R - B) / 255.0, -1.0, 1.0)


# ---------------------------------------------------------------------------
# Display mapping and colour rendering (shared)
# ---------------------------------------------------------------------------

def _to_display(raw: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return np.clip((raw - lo) / (hi - lo), 0.0, 1.0)


# NDVI ramp: dark red (stressed) → dark green (healthy)
NDVI_RAMP = [
    (0.00, (127,   0,   0, 200)),
    (0.15, (198,  40,  40, 190)),
    (0.30, (239,  68,  68, 175)),
    (0.40, (249, 115,  22, 165)),
    (0.50, (234, 179,   8, 150)),
    (0.65, (163, 230,  53, 135)),
    (0.80, ( 34, 197,  94, 120)),
    (1.00, ( 21, 128,  61, 110)),
]

# NDRE ramp: purple (low) → green (high)
NDRE_RAMP = [
    (0.00, (147,  51, 234, 200)),
    (0.20, (236,  72, 153, 185)),
    (0.40, (249, 115,  22, 165)),
    (0.55, (234, 179,   8, 150)),
    (0.70, (132, 204,  22, 135)),
    (0.85, ( 34, 197,  94, 120)),
    (1.00, ( 21, 128,  61, 110)),
]

# NDMI ramp: amber/brown (dry/stressed) → teal/blue (well-moistened)
NDMI_RAMP = [
    (0.00, (146,  64,  14, 200)),
    (0.20, (217, 119,   6, 185)),
    (0.35, (234, 179,   8, 170)),
    (0.50, ( 20, 184, 166, 150)),
    (0.70, ( 14, 116, 144, 130)),
    (1.00, (  7,  89, 133, 110)),
]

# EVI ramp: red (stressed) → dark green (healthy) — calibrated for EVI value range
EVI_RAMP = [
    (0.00, (127,   0,   0, 200)),
    (0.15, (220,  38,  38, 190)),
    (0.30, (249, 115,  22, 175)),
    (0.45, (234, 179,   8, 160)),
    (0.60, (132, 204,  22, 140)),
    (0.80, ( 34, 197,  94, 120)),
    (1.00, ( 21, 128,  61, 110)),
]

# NDWI ramp: orange-red (no water) → blue (water body present)
NDWI_RAMP = [
    (0.00, (154,  52,  18, 200)),
    (0.25, (249, 115,  22, 185)),
    (0.45, (234, 179,   8, 165)),
    (0.60, ( 56, 189, 248, 150)),
    (0.80, ( 14, 165, 233, 130)),
    (1.00, (  7, 104, 159, 110)),
]


def _colorize(values: np.ndarray, mask: np.ndarray, ramp: list) -> np.ndarray:
    """Apply colour ramp to [0..1] array; transparent outside mask or where NaN."""
    h, w = values.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    valid = mask & np.isfinite(values)

    for i in range(len(ramp) - 1):
        lo, cs = ramp[i]
        hi, ce = ramp[i + 1]
        region = valid & (values >= lo) & (values < hi)
        if not region.any():
            continue
        t = ((values[region] - lo) / (hi - lo)).reshape(-1, 1)
        out[region] = np.clip(
            np.array(cs, dtype=float) * (1 - t) + np.array(ce, dtype=float) * t, 0, 255
        ).astype(np.uint8)

    last = valid & (values >= ramp[-1][0])
    if last.any():
        out[last] = ramp[-1][1]

    out[:, :, 3][~valid] = 0
    return out


def _to_b64_png(rgba: np.ndarray) -> str:
    buf = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(buf, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"


def _to_b64_png_rgb(rgb: np.ndarray) -> str:
    """Encode a uint8 (H, W, 3) array as a base64 PNG data URL."""
    buf = io.BytesIO()
    Image.fromarray(rgb.astype(np.uint8), "RGB").save(buf, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"


# ---------------------------------------------------------------------------
# Stats, zones, and signals derived from the display values
# ---------------------------------------------------------------------------

def _compute_stats(display: np.ndarray, mask: np.ndarray, field_ha: float) -> dict:
    vals = display[mask]
    if len(vals) == 0:
        return {
            "cropHealthScore": 50, "maxScore": 100, "scoreLabel": "Unknown",
            "abnormalZones": 0, "affectedAreaHa": 0.0, "affectedAreaPct": 0,
            "trend": "Stable", "trendDelta": "Live scan",
            "topPriority": "—", "topPriorityLevel": "Low",
        }

    avg = float(np.nanmean(vals))
    if np.isnan(avg):
        avg = 0.5
    score = int(round(avg * 100))
    label = (
        "Excellent" if score >= 80 else
        "Good"      if score >= 65 else
        "Fair"      if score >= 50 else
        "Poor"
    )
    stressed_pct = round(float(np.nanmean(vals < 0.45) * 100), 1)

    return {
        "cropHealthScore": score,
        "maxScore": 100,
        "scoreLabel": label,
        "abnormalZones": 0,
        "affectedAreaHa": round(stressed_pct / 100 * field_ha, 1),
        "affectedAreaPct": stressed_pct,
        "trend": "Stable",
        "trendDelta": "Live scan",
        "topPriority": "—",
        "topPriorityLevel": "Low",
    }


def _compute_zones(display: np.ndarray, mask: np.ndarray, field_ha: float) -> list:
    h, w = display.shape
    zone_defs = [
        ("A", "North-West", slice(0, h // 2),      slice(0, w // 2)),
        ("B", "North-East", slice(0, h // 2),      slice(w // 2, w)),
        ("C", "Centre",     slice(h // 4, 3*h//4), slice(w // 4, 3*w//4)),
        ("D", "South-West", slice(h // 2, h),      slice(0, w // 2)),
        ("E", "South-East", slice(h // 2, h),      slice(w // 2, w)),
    ]
    total_px = mask.sum() or 1
    zones = []

    for zid, name, rs, cs in zone_defs:
        zm = np.zeros_like(mask)
        zm[rs, cs] = mask[rs, cs]
        if not zm.any():
            continue

        avg = float(np.mean(display[zm]))
        severity = (
            "Very High" if avg < 0.30 else
            "High"      if avg < 0.45 else
            "Moderate"  if avg < 0.55 else
            "Low"       if avg < 0.65 else
            "Improving"
        )
        zone_frac = float(zm.sum()) / total_px
        stressed_frac = float(np.mean(display[zm] < 0.45))

        zones.append({
            "id": zid,
            "name": name,
            "severity": severity,
            "areaHa": round(stressed_frac * zone_frac * field_ha, 2),
            "trend": "stable",
        })

    return zones


def _compute_signals(zones: list, stats: dict) -> list:
    sigs = []
    stressed_pct = stats["affectedAreaPct"]

    if stressed_pct > 30:
        sigs.append({
            "icon": "💧",
            "title": "Moisture stress likely",
            "description": f"{stressed_pct:.0f}% of field showing low vegetation signal — check soil moisture.",
            "severity": "High",
        })

    high_zones = [z for z in zones if z["severity"] in ("Very High", "High")]
    if high_zones:
        names = " & ".join(z["name"] for z in high_zones[:2])
        sigs.append({
            "icon": "📍",
            "title": f"Stress detected — {names}",
            "description": "Scout these zones before the next application to confirm the cause.",
            "severity": "High",
        })

    score = stats["cropHealthScore"]
    if score < 55:
        sigs.append({
            "icon": "🌾",
            "title": "Possible nutrient deficiency",
            "description": f"Health score {score}/100 — consider tissue test or targeted nitrogen application.",
            "severity": "Medium",
        })
    elif score >= 75:
        sigs.append({
            "icon": "✅",
            "title": "Field in good condition",
            "description": f"Health score {score}/100 — continue current management plan.",
            "severity": "Low",
        })

    if not sigs:
        sigs.append({
            "icon": "📊",
            "title": "Spatial variability detected",
            "description": "Some variation present — monitor over the next scan cycle.",
            "severity": "Medium",
        })

    return sigs


# ---------------------------------------------------------------------------
# Fallback (used when both satellite paths fail)
# ---------------------------------------------------------------------------

def _fallback_overlay() -> str:
    rng = np.random.default_rng(42)
    h, w = 256, 256
    data = rng.random((h, w)) * 0.40 + 0.35
    data[20:85,  15:95]  *= 0.30
    data[75:125, 130:195] *= 0.45
    data[115:165, 18:95]  *= 0.55
    data[130:170, 98:148] *= 0.65
    mask = np.ones((h, w), dtype=bool)
    return _to_b64_png(_colorize(np.clip(data, 0, 1), mask, NDVI_RAMP))


FALLBACK_ZONES = [
    {"id": "A", "name": "North-West",  "severity": "Very High", "areaHa": 0.8, "trend": "stable"},
    {"id": "B", "name": "North-East",  "severity": "High",      "areaHa": 0.6, "trend": "stable"},
    {"id": "C", "name": "Centre",      "severity": "Moderate",  "areaHa": 0.5, "trend": "stable"},
    {"id": "D", "name": "South-West",  "severity": "Low",       "areaHa": 0.4, "trend": "stable"},
    {"id": "E", "name": "South-East",  "severity": "Improving", "areaHa": 0.3, "trend": "stable"},
]

FALLBACK_STATS = {
    "cropHealthScore": 62, "maxScore": 100, "scoreLabel": "Fair",
    "ndreScore": 58, "ndmiScore": None, "eviScore": None, "ndwiScore": None, "variScore": 62,
    "abnormalZones": 2, "affectedAreaHa": 1.4, "affectedAreaPct": 28,
    "trend": "Stable", "trendDelta": "Satellite unavailable",
    "topPriority": "North-West", "topPriorityLevel": "Very High",
}

FALLBACK_SIGNALS = [
    {"icon": "📡", "title": "Satellite data unavailable",
     "description": "Could not retrieve imagery for this field. Showing indicative data.",
     "severity": "Low"},
]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/scenes")
async def list_scenes(field: FieldFeature):
    """List available Sentinel-2 acquisition dates for a field (last 60 days)."""
    import requests as _requests
    from datetime import datetime, timedelta

    coords = field.geometry.coordinates[0]
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    bbox = [min(lngs), min(lats), max(lngs), max(lats)]

    end_dt = datetime.utcnow()
    start_dt = end_dt - timedelta(days=90)

    try:
        resp = _requests.post(STAC_SEARCH_URL, json={
            "collections": ["sentinel-2-l2a"],
            "bbox": bbox,
            "datetime": f"{start_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}/{end_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}",
            "query": {"eo:cloud_cover": {"lt": 90}},
            "limit": 50,
        }, timeout=20)
        resp.raise_for_status()
        items = resp.json().get("features", [])
    except Exception:
        return []

    # Deduplicate by date, keeping lowest cloud cover per date
    seen: dict = {}
    for item in items:
        date = item["properties"]["datetime"][:10]
        cloud = item["properties"].get("eo:cloud_cover", 0)
        if date not in seen or cloud < seen[date]["cloud_cover"]:
            seen[date] = {"date": date, "cloud_cover": round(cloud, 1)}

    return sorted(seen.values(), key=lambda x: x["date"], reverse=True)


@router.post("/analyse")
async def analyse_field(field: FieldFeature, scene_date: Optional[str] = Query(None), quick: bool = Query(False)):
    coords = field.geometry.coordinates[0]
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    min_lng, max_lng = min(lngs), max(lngs)
    min_lat, max_lat = min(lats), max(lats)
    field_ha = float(field.properties.get("area_hectares", 5.0))

    west, south, east, north = min_lng, min_lat, max_lng, max_lat
    actual_scene_date = scene_date

    # ── Path A: Esri RGB tiles → high-res VARI/ExGI overlay ────────────────
    # Esri tiles are ~1m resolution vs Sentinel-2's 10m, giving 100× more
    # pixels over a small field.  Always compute VARI/ExGI from these for the
    # dedicated VARI layer and as a fallback for stats.
    vari_display = None
    exgi_display = None
    rgb_array = None
    source = "RGB est."
    try:
        mosaic, west, south, east, north = _fetch_esri_mosaic(
            min_lng, min_lat, max_lng, max_lat
        )
        # Smooth out JPEG 8×8 block artefacts before computing indices.
        mosaic_smooth = np.array(Image.fromarray(mosaic).filter(ImageFilter.GaussianBlur(radius=2)))
        vari_display = _to_display(_vari(mosaic_smooth), -0.2, 0.5)
        exgi_display = _to_display(_exgi(mosaic_smooth), -0.3, 0.6)
        rgb_array = mosaic
    except Exception:
        pass

    # ── Path B: Sentinel-2 → NDVI, NDRE, NDMI, EVI, NDWI ─────────────────
    # S2 is 10m resolution; used for all spectral overlay layers and for the
    # comparison-panel statistics.  Skipped in quick mode (overview page).
    s2_ndvi_display = None
    s2_ndre_display = None
    s2_ndmi_display = None
    s2_evi_display = None
    s2_ndwi_display = None
    s2_mask_bounds = None
    if not quick:
        try:
            ndvi_raw, ndre_raw, ndmi_raw, evi_raw, ndwi_raw, _rgb_s2, w_s2, s_s2, e_s2, n_s2, actual_scene_date = _fetch_sentinel2(
                min_lng, min_lat, max_lng, max_lat, target_date=scene_date
            )
            s2_ndvi_display = _to_display(ndvi_raw, 0.1, 0.95)
            s2_ndre_display = _to_display(ndre_raw, 0.05, 0.85)
            s2_ndmi_display = _to_display(ndmi_raw, -0.2, 0.5) if ndmi_raw is not None else None
            s2_evi_display  = _to_display(evi_raw,  -0.1, 0.7) if evi_raw  is not None else None
            s2_ndwi_display = _to_display(ndwi_raw, -0.5, 0.3) if ndwi_raw is not None else None
            s2_mask_bounds = (w_s2, s_s2, e_s2, n_s2)
            # Don't use S2 visual for RGB overlay — Esri tiles are higher resolution
            # and don't have cloud-masked black areas.
            source = "S2 stats"
        except Exception:
            actual_scene_date = None

    # ── Path C: total fallback ─────────────────────────────────────────────
    if vari_display is None:
        bounds = [[min_lat, min_lng], [max_lat, max_lng]]
        fb_stats = dict(FALLBACK_STATS)
        fb_stats["variScore"] = fb_stats["cropHealthScore"]
        return {
            "ndvi_overlay": None,
            "ndre_overlay": None,
            "ndmi_overlay": None,
            "evi_overlay": None,
            "ndwi_overlay": None,
            "vari_overlay": _fallback_overlay(),
            "rgb_overlay": None,
            "actual_scene_date": None,
            "ndvi_bounds": None,
            "bounds": bounds,
            "zones": FALLBACK_ZONES,
            "stats": fb_stats,
            "detected_signals": FALLBACK_SIGNALS,
            "vegetation_layer": "unavailable",
        }

    # ── Render VARI overlay (Esri, always available) ───────────────────────
    h, w = vari_display.shape
    esri_mask = _poly_mask(coords, w, h, west, south, east, north)
    vari_overlay = _to_b64_png(_colorize(vari_display, esri_mask, NDVI_RAMP))
    vari_vals = vari_display[esri_mask]
    vari_score = int(round(float(np.nanmean(vari_vals)) * 100)) if len(vari_vals) > 0 else 50

    # ── Render S2 overlays (NDVI, NDRE, NDMI, EVI, NDWI) ──────────────────
    ndvi_overlay = None
    ndre_overlay = None
    ndmi_overlay = None
    evi_overlay = None
    ndwi_overlay = None
    ndvi_bounds = None
    s2_mask = None
    if s2_ndvi_display is not None and s2_mask_bounds is not None:
        sh, sw = s2_ndvi_display.shape
        s2_mask = _poly_mask(coords, sw, sh, *s2_mask_bounds)
        ndvi_overlay = _to_b64_png(_colorize(s2_ndvi_display, s2_mask, NDVI_RAMP))
        ndvi_bounds = [[s2_mask_bounds[1], s2_mask_bounds[0]],
                       [s2_mask_bounds[3], s2_mask_bounds[2]]]
        if s2_ndre_display is not None:
            ndre_overlay = _to_b64_png(_colorize(s2_ndre_display, s2_mask, NDRE_RAMP))
        if s2_ndmi_display is not None:
            ndmi_overlay = _to_b64_png(_colorize(s2_ndmi_display, s2_mask, NDMI_RAMP))
        if s2_evi_display is not None:
            evi_overlay = _to_b64_png(_colorize(s2_evi_display, s2_mask, EVI_RAMP))
        if s2_ndwi_display is not None:
            ndwi_overlay = _to_b64_png(_colorize(s2_ndwi_display, s2_mask, NDWI_RAMP))

    def _s2_score(arr):
        if arr is None or s2_mask is None:
            return None
        vals = arr[s2_mask]
        m = float(np.nanmean(vals)) if len(vals) > 0 else float('nan')
        return None if np.isnan(m) else int(round(m * 100))

    # ── Stats: S2 when available (accurate), else Esri VARI (fallback) ─────
    if s2_mask is not None and s2_ndvi_display is not None:
        stats = _compute_stats(s2_ndvi_display, s2_mask, field_ha)
        s2_ndre_vals = s2_ndre_display[s2_mask] if s2_ndre_display is not None else np.array([])
        ndre_mean = float(np.nanmean(s2_ndre_vals)) if len(s2_ndre_vals) > 0 else float('nan')
        stats["ndreScore"] = 0 if np.isnan(ndre_mean) else int(round(ndre_mean * 100))
        zones = _compute_zones(s2_ndvi_display, s2_mask, field_ha)
    else:
        stats = _compute_stats(vari_display, esri_mask, field_ha)
        exgi_vals = exgi_display[esri_mask] if exgi_display is not None else np.array([])
        ndre_mean = float(np.nanmean(exgi_vals)) if len(exgi_vals) > 0 else float('nan')
        stats["ndreScore"] = 0 if np.isnan(ndre_mean) else int(round(ndre_mean * 100))
        zones = _compute_zones(vari_display, esri_mask, field_ha)

    stats["ndmiScore"] = _s2_score(s2_ndmi_display)
    stats["eviScore"]  = _s2_score(s2_evi_display)
    stats["ndwiScore"] = _s2_score(s2_ndwi_display)
    stats["variScore"] = vari_score

    if zones:
        severity_order = ["Improving", "Low", "Moderate", "High", "Very High"]
        worst = max(zones, key=lambda z: severity_order.index(z["severity"]))
        stats["topPriority"] = worst["name"]
        stats["topPriorityLevel"] = worst["severity"]
        stats["abnormalZones"] = sum(
            1 for z in zones if z["severity"] not in ("Improving", "Low")
        )

    bounds = [[south, west], [north, east]]

    rgb_overlay = None
    if rgb_array is not None:
        try:
            rgb_pil = Image.fromarray(rgb_array.astype(np.uint8), "RGB").resize((w, h), Image.BILINEAR)
            rgb_overlay = _to_b64_png_rgb(np.array(rgb_pil))
        except Exception:
            rgb_overlay = None

    return {
        "ndvi_overlay": ndvi_overlay,
        "ndre_overlay": ndre_overlay,
        "ndmi_overlay": ndmi_overlay,
        "evi_overlay":  evi_overlay,
        "ndwi_overlay": ndwi_overlay,
        "vari_overlay": vari_overlay,
        "rgb_overlay": rgb_overlay,
        "actual_scene_date": actual_scene_date,
        "ndvi_bounds": ndvi_bounds,
        "bounds": bounds,
        "zones": zones,
        "stats": stats,
        "detected_signals": _compute_signals(zones, stats),
        "vegetation_layer": source,
    }
