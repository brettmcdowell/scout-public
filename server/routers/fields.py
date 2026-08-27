from fastapi import APIRouter

from models.schemas import DetectRequest, FieldCollection
from services.field_generator import generate_fields

router = APIRouter(prefix="/api/fields", tags=["fields"])


@router.post("/detect", response_model=FieldCollection)
async def detect_fields(req: DetectRequest):
    return generate_fields(req.bbox, req.center)
