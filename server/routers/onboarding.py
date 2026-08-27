import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from models.schemas import (
    FarmMeta,
    FarmResponse,
    FieldCollection,
    SaveRequest,
    SaveResponse,
)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "farms"
DATA_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/save", response_model=SaveResponse)
async def save_onboarding(req: SaveRequest):
    farm_id = str(uuid.uuid4())
    total_area = sum(f.properties.area_hectares for f in req.selected_fields)

    # Persist GeoJSON
    collection = FieldCollection(features=req.selected_fields)
    (DATA_DIR / f"{farm_id}.geojson").write_text(
        collection.model_dump_json(indent=2)
    )

    # Persist metadata
    meta = FarmMeta(
        farm_id=farm_id,
        postcode=req.postcode,
        center=req.center,
        field_count=len(req.selected_fields),
        total_area_hectares=round(total_area, 1),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    (DATA_DIR / f"{farm_id}.json").write_text(meta.model_dump_json(indent=2))

    return SaveResponse(
        status="saved",
        farm_id=farm_id,
        field_count=len(req.selected_fields),
        total_area_hectares=round(total_area, 1),
    )
