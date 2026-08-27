import json
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.schemas import FarmMeta, FarmResponse, FieldCollection

router = APIRouter(prefix="/api/farms", tags=["farms"])

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "farms"


def _load_farm(farm_id: str) -> FarmResponse:
    meta_path = DATA_DIR / f"{farm_id}.json"
    geojson_path = DATA_DIR / f"{farm_id}.geojson"

    if not meta_path.exists() or not geojson_path.exists():
        raise HTTPException(status_code=404, detail="Farm not found")

    meta = FarmMeta.model_validate_json(meta_path.read_text())
    fields = FieldCollection.model_validate_json(geojson_path.read_text())
    return FarmResponse(meta=meta, fields=fields)


@router.get("/latest", response_model=FarmResponse)
async def get_latest_farm():
    """Return the most recently saved farm."""
    json_files = sorted(DATA_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not json_files:
        raise HTTPException(status_code=404, detail="No farms saved yet")

    farm_id = json_files[0].stem
    return _load_farm(farm_id)


@router.get("/{farm_id}", response_model=FarmResponse)
async def get_farm(farm_id: str):
    """Return a specific farm by ID."""
    return _load_farm(farm_id)


class CropDetailUpdate(BaseModel):
    field_id: str
    crop_type: Optional[str] = None
    sowing_date: Optional[str] = None


class CropDetailsRequest(BaseModel):
    updates: list[CropDetailUpdate]


@router.patch("/{farm_id}/crop-details")
async def update_crop_details(farm_id: str, req: CropDetailsRequest):
    """Update crop_type and sowing_date for one or more fields in a farm."""
    geojson_path = DATA_DIR / f"{farm_id}.geojson"
    if not geojson_path.exists():
        raise HTTPException(status_code=404, detail="Farm not found")

    raw = json.loads(geojson_path.read_text())
    update_map = {u.field_id: u for u in req.updates}

    for feature in raw.get("features", []):
        fid = feature.get("id")
        if fid in update_map:
            u = update_map[fid]
            props = feature.setdefault("properties", {})
            if u.crop_type is not None:
                props["crop_type"] = u.crop_type or None
            if u.sowing_date is not None:
                props["sowing_date"] = u.sowing_date or None

    geojson_path.write_text(json.dumps(raw, indent=2))
    return {"status": "updated"}
