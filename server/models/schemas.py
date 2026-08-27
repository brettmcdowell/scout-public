from pydantic import BaseModel
from typing import Any, Optional


class Coordinates(BaseModel):
    lat: float
    lng: float


class BoundingBox(BaseModel):
    north: float
    south: float
    east: float
    west: float


class DetectRequest(BaseModel):
    bbox: BoundingBox
    center: Coordinates


class FieldGeometry(BaseModel):
    type: str = "Polygon"
    coordinates: list[list[list[float]]]


class FieldProperties(BaseModel):
    name: str
    area_hectares: float
    perimeter_m: float
    crop_type: Optional[str] = None
    sowing_date: Optional[str] = None


class FieldFeature(BaseModel):
    type: str = "Feature"
    id: str
    properties: FieldProperties
    geometry: FieldGeometry


class FieldCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[FieldFeature]


class SaveRequest(BaseModel):
    postcode: str
    center: Coordinates
    selected_fields: list[FieldFeature]


class SaveResponse(BaseModel):
    status: str
    farm_id: str
    field_count: int
    total_area_hectares: float


class FarmMeta(BaseModel):
    farm_id: str
    postcode: str
    center: Coordinates
    field_count: int
    total_area_hectares: float
    created_at: str


class FarmResponse(BaseModel):
    meta: FarmMeta
    fields: FieldCollection
