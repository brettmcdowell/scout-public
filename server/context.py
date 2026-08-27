"""Agronomic context analysis.

Combines crop growth stage (GDD-based), weather (Open-Meteo), and soil data
(SoilGrids) with satellite indices to produce contextual signals for farmers.
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
import requests as _requests
from datetime import date, datetime, timedelta

router = APIRouter(prefix="/api/context")


class GeoJSONGeometry(BaseModel):
    type: str
    coordinates: list


class FieldFeature(BaseModel):
    type: str = "Feature"
    geometry: GeoJSONGeometry
    properties: dict


# ---------------------------------------------------------------------------
# Crop stage library (GDD-based, UK-focused)
# ---------------------------------------------------------------------------

CROP_STAGES = {
    "winter_wheat": {
        "name": "Winter Wheat",
        "base_temp": 0.0,
        "stages": [
            {"label": "Germination",  "zadoks": "GS00–09", "gdd_max": 120,  "ndvi_lo": 0.10, "ndvi_hi": 0.25},
            {"label": "Emergence",    "zadoks": "GS10",    "gdd_max": 200,  "ndvi_lo": 0.20, "ndvi_hi": 0.35},
            {"label": "Tillering",    "zadoks": "GS20–29", "gdd_max": 450,  "ndvi_lo": 0.35, "ndvi_hi": 0.55},
            {"label": "Jointing",     "zadoks": "GS30–39", "gdd_max": 700,  "ndvi_lo": 0.55, "ndvi_hi": 0.75},
            {"label": "Flag Leaf",    "zadoks": "GS37–39", "gdd_max": 900,  "ndvi_lo": 0.65, "ndvi_hi": 0.82},
            {"label": "Heading",      "zadoks": "GS51–59", "gdd_max": 1100, "ndvi_lo": 0.65, "ndvi_hi": 0.85},
            {"label": "Flowering",    "zadoks": "GS61–69", "gdd_max": 1300, "ndvi_lo": 0.60, "ndvi_hi": 0.80},
            {"label": "Grain Fill",   "zadoks": "GS71–87", "gdd_max": 1700, "ndvi_lo": 0.55, "ndvi_hi": 0.75},
            {"label": "Ripening",     "zadoks": "GS87–99", "gdd_max": 2100, "ndvi_lo": 0.25, "ndvi_hi": 0.52},
        ],
    },
    "winter_barley": {
        "name": "Winter Barley",
        "base_temp": 0.0,
        "stages": [
            {"label": "Germination",  "zadoks": "GS00–09", "gdd_max": 100,  "ndvi_lo": 0.10, "ndvi_hi": 0.25},
            {"label": "Emergence",    "zadoks": "GS10",    "gdd_max": 180,  "ndvi_lo": 0.20, "ndvi_hi": 0.35},
            {"label": "Tillering",    "zadoks": "GS20–29", "gdd_max": 400,  "ndvi_lo": 0.35, "ndvi_hi": 0.55},
            {"label": "Jointing",     "zadoks": "GS30–39", "gdd_max": 620,  "ndvi_lo": 0.55, "ndvi_hi": 0.75},
            {"label": "Flag Leaf",    "zadoks": "GS37–39", "gdd_max": 800,  "ndvi_lo": 0.60, "ndvi_hi": 0.80},
            {"label": "Heading",      "zadoks": "GS51–59", "gdd_max": 950,  "ndvi_lo": 0.60, "ndvi_hi": 0.83},
            {"label": "Flowering",    "zadoks": "GS61–69", "gdd_max": 1150, "ndvi_lo": 0.55, "ndvi_hi": 0.78},
            {"label": "Grain Fill",   "zadoks": "GS71–87", "gdd_max": 1500, "ndvi_lo": 0.45, "ndvi_hi": 0.70},
            {"label": "Ripening",     "zadoks": "GS87–99", "gdd_max": 1900, "ndvi_lo": 0.20, "ndvi_hi": 0.48},
        ],
    },
    "spring_barley": {
        "name": "Spring Barley",
        "base_temp": 0.0,
        "stages": [
            {"label": "Germination",  "zadoks": "GS00–09", "gdd_max": 80,   "ndvi_lo": 0.10, "ndvi_hi": 0.22},
            {"label": "Emergence",    "zadoks": "GS10",    "gdd_max": 150,  "ndvi_lo": 0.18, "ndvi_hi": 0.32},
            {"label": "Tillering",    "zadoks": "GS20–29", "gdd_max": 350,  "ndvi_lo": 0.32, "ndvi_hi": 0.52},
            {"label": "Jointing",     "zadoks": "GS30–39", "gdd_max": 550,  "ndvi_lo": 0.50, "ndvi_hi": 0.72},
            {"label": "Flag Leaf",    "zadoks": "GS37–39", "gdd_max": 720,  "ndvi_lo": 0.58, "ndvi_hi": 0.78},
            {"label": "Heading",      "zadoks": "GS51–59", "gdd_max": 880,  "ndvi_lo": 0.58, "ndvi_hi": 0.80},
            {"label": "Grain Fill",   "zadoks": "GS71–87", "gdd_max": 1200, "ndvi_lo": 0.40, "ndvi_hi": 0.68},
            {"label": "Ripening",     "zadoks": "GS87–99", "gdd_max": 1500, "ndvi_lo": 0.18, "ndvi_hi": 0.45},
        ],
    },
    "spring_wheat": {
        "name": "Spring Wheat",
        "base_temp": 0.0,
        "stages": [
            {"label": "Germination",  "zadoks": "GS00–09", "gdd_max": 100,  "ndvi_lo": 0.10, "ndvi_hi": 0.25},
            {"label": "Emergence",    "zadoks": "GS10",    "gdd_max": 180,  "ndvi_lo": 0.18, "ndvi_hi": 0.33},
            {"label": "Tillering",    "zadoks": "GS20–29", "gdd_max": 400,  "ndvi_lo": 0.33, "ndvi_hi": 0.55},
            {"label": "Jointing",     "zadoks": "GS30–39", "gdd_max": 650,  "ndvi_lo": 0.53, "ndvi_hi": 0.73},
            {"label": "Flag Leaf",    "zadoks": "GS37–39", "gdd_max": 850,  "ndvi_lo": 0.63, "ndvi_hi": 0.80},
            {"label": "Heading",      "zadoks": "GS51–59", "gdd_max": 1050, "ndvi_lo": 0.63, "ndvi_hi": 0.83},
            {"label": "Grain Fill",   "zadoks": "GS71–87", "gdd_max": 1450, "ndvi_lo": 0.52, "ndvi_hi": 0.73},
            {"label": "Ripening",     "zadoks": "GS87–99", "gdd_max": 1850, "ndvi_lo": 0.22, "ndvi_hi": 0.50},
        ],
    },
    "oilseed_rape": {
        "name": "Oilseed Rape",
        "base_temp": 0.0,
        "stages": [
            {"label": "Establishment", "zadoks": None,     "gdd_max": 150,  "ndvi_lo": 0.15, "ndvi_hi": 0.35},
            {"label": "Rosette",       "zadoks": None,     "gdd_max": 400,  "ndvi_lo": 0.45, "ndvi_hi": 0.70},
            {"label": "Stem Extension","zadoks": None,     "gdd_max": 700,  "ndvi_lo": 0.60, "ndvi_hi": 0.82},
            {"label": "Flowering",     "zadoks": None,     "gdd_max": 1000, "ndvi_lo": 0.55, "ndvi_hi": 0.78},
            {"label": "Podding",       "zadoks": None,     "gdd_max": 1400, "ndvi_lo": 0.45, "ndvi_hi": 0.70},
            {"label": "Ripening",      "zadoks": None,     "gdd_max": 1800, "ndvi_lo": 0.18, "ndvi_hi": 0.45},
        ],
    },
    "potatoes": {
        "name": "Potatoes",
        "base_temp": 8.0,
        "stages": [
            {"label": "Emergence",          "zadoks": None, "gdd_max": 100,  "ndvi_lo": 0.15, "ndvi_hi": 0.35},
            {"label": "Canopy Development", "zadoks": None, "gdd_max": 350,  "ndvi_lo": 0.45, "ndvi_hi": 0.72},
            {"label": "Tuber Initiation",   "zadoks": None, "gdd_max": 600,  "ndvi_lo": 0.62, "ndvi_hi": 0.82},
            {"label": "Tuber Bulking",      "zadoks": None, "gdd_max": 1000, "ndvi_lo": 0.60, "ndvi_hi": 0.80},
            {"label": "Maturation",         "zadoks": None, "gdd_max": 1400, "ndvi_lo": 0.30, "ndvi_hi": 0.60},
        ],
    },
    "sugar_beet": {
        "name": "Sugar Beet",
        "base_temp": 3.0,
        "stages": [
            {"label": "Emergence",     "zadoks": None, "gdd_max": 150,  "ndvi_lo": 0.12, "ndvi_hi": 0.30},
            {"label": "Canopy Cover",  "zadoks": None, "gdd_max": 500,  "ndvi_lo": 0.40, "ndvi_hi": 0.68},
            {"label": "Root Growth",   "zadoks": None, "gdd_max": 1000, "ndvi_lo": 0.62, "ndvi_hi": 0.82},
            {"label": "Sugar Filling", "zadoks": None, "gdd_max": 1500, "ndvi_lo": 0.55, "ndvi_hi": 0.78},
            {"label": "Maturation",    "zadoks": None, "gdd_max": 2000, "ndvi_lo": 0.35, "ndvi_hi": 0.65},
        ],
    },
    "maize": {
        "name": "Maize",
        "base_temp": 10.0,
        "stages": [
            {"label": "Emergence",     "zadoks": None, "gdd_max": 120,  "ndvi_lo": 0.12, "ndvi_hi": 0.30},
            {"label": "Vegetative",    "zadoks": None, "gdd_max": 500,  "ndvi_lo": 0.45, "ndvi_hi": 0.72},
            {"label": "Tasselling",    "zadoks": None, "gdd_max": 800,  "ndvi_lo": 0.65, "ndvi_hi": 0.85},
            {"label": "Silking",       "zadoks": None, "gdd_max": 1000, "ndvi_lo": 0.65, "ndvi_hi": 0.85},
            {"label": "Grain Fill",    "zadoks": None, "gdd_max": 1500, "ndvi_lo": 0.55, "ndvi_hi": 0.78},
            {"label": "Maturity",      "zadoks": None, "gdd_max": 2000, "ndvi_lo": 0.25, "ndvi_hi": 0.55},
        ],
    },
    "grassland": {
        "name": "Grassland / Pasture",
        "base_temp": 5.0,
        "stages": [
            {"label": "Dormant",    "zadoks": None, "gdd_max": 50,   "ndvi_lo": 0.20, "ndvi_hi": 0.45},
            {"label": "Early Growth","zadoks": None, "gdd_max": 200,  "ndvi_lo": 0.45, "ndvi_hi": 0.65},
            {"label": "Active",     "zadoks": None, "gdd_max": 600,  "ndvi_lo": 0.60, "ndvi_hi": 0.80},
            {"label": "Mature",     "zadoks": None, "gdd_max": 1200, "ndvi_lo": 0.55, "ndvi_hi": 0.75},
        ],
    },
}

CROP_DISPLAY_NAMES = {k: v["name"] for k, v in CROP_STAGES.items()}


def _centroid(coords: list) -> tuple[float, float]:
    """Return (lat, lng) centroid of a polygon's outer ring."""
    ring = coords[0]
    lats = [p[1] for p in ring]
    lngs = [p[0] for p in ring]
    return sum(lats) / len(lats), sum(lngs) / len(lngs)


# ---------------------------------------------------------------------------
# Weather: Open-Meteo (free, no API key required)
# ---------------------------------------------------------------------------

def _fetch_weather(lat: float, lng: float, sowing_date: Optional[str] = None) -> dict:
    """Fetch 7-day history + 3-day forecast and historical GDD since sowing."""
    base = "https://api.open-meteo.com/v1/forecast"
    resp = _requests.get(base, params={
        "latitude": lat,
        "longitude": lng,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "past_days": 7,
        "forecast_days": 3,
        "timezone": "auto",
    }, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    daily = data.get("daily", {})
    dates = daily.get("time", [])
    tmax = daily.get("temperature_2m_max", [])
    tmin = daily.get("temperature_2m_min", [])
    precip = daily.get("precipitation_sum", [])

    today_str = date.today().isoformat()
    past_precip = [p for d, p in zip(dates, precip) if d <= today_str and p is not None]
    future_precip = [p for d, p in zip(dates, precip) if d > today_str and p is not None]
    past_tmeans = [(a + b) / 2 for a, b, d in zip(tmax, tmin, dates)
                   if d <= today_str and a is not None and b is not None]

    daily_precip_7d = past_precip[-7:]
    rain_7d = round(sum(daily_precip_7d), 1)
    temp_avg_7d = round(sum(past_tmeans[-7:]) / max(len(past_tmeans[-7:]), 1), 1)
    forecast_rain_3d = round(sum(future_precip[:3]), 1)

    # GDD accumulation from sowing date
    gdd_accumulated = None
    daily_gdd = []
    if sowing_date:
        try:
            gdd_accumulated, daily_gdd = _fetch_gdd_since_sowing(lat, lng, sowing_date)
        except Exception:
            pass

    return {
        "rain_7d": rain_7d,
        "temp_avg_7d": temp_avg_7d,
        "forecast_rain_3d": forecast_rain_3d,
        "daily_precipitation": daily_precip_7d,
        "gdd_accumulated": gdd_accumulated,
        "daily_gdd": daily_gdd,
    }


def _fetch_gdd_since_sowing(lat: float, lng: float, sowing_date: str) -> tuple[float, list]:
    """Accumulate GDD from sowing_date to yesterday using Open-Meteo archive."""
    sow = datetime.strptime(sowing_date, "%Y-%m-%d").date()
    yesterday = date.today() - timedelta(days=1)
    if sow >= yesterday:
        return 0.0, []

    archive_url = "https://archive-api.open-meteo.com/v1/archive"
    resp = _requests.get(archive_url, params={
        "latitude": lat,
        "longitude": lng,
        "start_date": sowing_date,
        "end_date": yesterday.isoformat(),
        "daily": "temperature_2m_max,temperature_2m_min",
        "timezone": "auto",
    }, timeout=15)
    resp.raise_for_status()
    daily = resp.json().get("daily", {})
    tmax_list = daily.get("temperature_2m_max", [])
    tmin_list = daily.get("temperature_2m_min", [])

    daily_gdd = []
    for hi, lo in zip(tmax_list, tmin_list):
        if hi is None or lo is None:
            daily_gdd.append(0.0)
        else:
            daily_gdd.append(round(max(0.0, (hi + lo) / 2), 2))

    return round(sum(daily_gdd), 1), daily_gdd


# ---------------------------------------------------------------------------
# Soil: SoilGrids REST API (free, no API key required)
# ---------------------------------------------------------------------------

def _fetch_soil(lat: float, lng: float) -> Optional[dict]:
    """Return soil properties from SoilGrids. Returns None on any failure."""
    try:
        resp = _requests.get(
            "https://rest.isric.org/soilgrids/v2.0/properties/query",
            params={
                "lat": lat,
                "lon": lng,
                "property": ["clay", "silt", "sand", "phh2o", "soc"],
                "depth": "0-5cm",
                "value": "mean",
            },
            timeout=10,
        )
        resp.raise_for_status()
        props = resp.json().get("properties", {}).get("layers", [])

        def _extract(name: str, scale: float = 1.0) -> Optional[float]:
            for layer in props:
                if layer.get("name") == name:
                    depths = layer.get("depths", [])
                    if depths:
                        val = depths[0].get("values", {}).get("mean")
                        if val is not None:
                            return round(val * scale, 2)
            return None

        return {
            "clay_pct": _extract("clay", 0.1),    # g/kg → %
            "silt_pct": _extract("silt", 0.1),
            "sand_pct": _extract("sand", 0.1),
            "ph": _extract("phh2o", 0.1),          # pH×10 → pH
            "soc_pct": _extract("soc", 0.01),      # dg/kg → %
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Growth stage lookup
# ---------------------------------------------------------------------------

def _resolve_stage(crop_type: str, gdd: float) -> Optional[dict]:
    """Return the current growth stage dict for a crop given accumulated GDD."""
    crop = CROP_STAGES.get(crop_type)
    if not crop:
        return None
    stages = crop["stages"]
    for stage in stages:
        if gdd <= stage["gdd_max"]:
            return stage
    return stages[-1]


def _stage_progress(crop_type: str, gdd: float) -> float:
    """Return 0–1 progress through the current stage."""
    crop = CROP_STAGES.get(crop_type)
    if not crop:
        return 0.0
    stages = crop["stages"]
    prev_max = 0.0
    for stage in stages:
        if gdd <= stage["gdd_max"]:
            span = stage["gdd_max"] - prev_max
            return min(1.0, (gdd - prev_max) / span) if span > 0 else 1.0
        prev_max = stage["gdd_max"]
    return 1.0


def _overall_progress(crop_type: str, gdd: float) -> float:
    """Return 0–1 progress through entire crop lifecycle."""
    crop = CROP_STAGES.get(crop_type)
    if not crop:
        return 0.0
    total = crop["stages"][-1]["gdd_max"]
    return min(1.0, gdd / total) if total > 0 else 0.0


# ---------------------------------------------------------------------------
# Rule engine
# ---------------------------------------------------------------------------

def _run_rules(
    crop_type: str,
    stage: Optional[dict],
    weather: dict,
    soil: Optional[dict],
    ndvi: Optional[float],
    ndmi: Optional[float],
    ndwi: Optional[float],
) -> list:
    signals = []

    # 1. NDVI vs crop-stage benchmark
    if ndvi is not None and stage is not None:
        lo, hi = stage["ndvi_lo"], stage["ndvi_hi"]
        if ndvi < lo - 0.08:
            signals.append({
                "type": "warning",
                "icon": "📉",
                "title": f"Below-expected canopy at {stage['label']}",
                "body": f"NDVI {ndvi:.2f} vs expected {lo:.2f}–{hi:.2f}. Possible stress, disease, or slow establishment.",
            })
        elif ndvi > hi + 0.05:
            signals.append({
                "type": "positive",
                "icon": "🌿",
                "title": f"Strong canopy at {stage['label']}",
                "body": f"NDVI {ndvi:.2f} is above typical range ({lo:.2f}–{hi:.2f}). Vigorous growth — maintain current management.",
            })
        elif ndvi >= lo and ndvi <= hi:
            signals.append({
                "type": "positive",
                "icon": "✅",
                "title": f"Canopy on track for {stage['label']}",
                "body": f"NDVI {ndvi:.2f} within expected range ({lo:.2f}–{hi:.2f}).",
            })

    # 2. Moisture deficit (NDMI + rain combined)
    rain_7d = weather.get("rain_7d", 999)
    if ndmi is not None and ndmi < 0.25 and rain_7d < 10:
        signals.append({
            "type": "warning",
            "icon": "💧",
            "title": "Moisture deficit risk",
            "body": f"NDMI {ndmi:.2f} (low moisture signal) with only {rain_7d}mm rainfall in the last 7 days. Consider irrigation.",
        })
    elif ndmi is not None and ndmi < 0.20:
        signals.append({
            "type": "warning",
            "icon": "💧",
            "title": "Low vegetation moisture",
            "body": f"NDMI {ndmi:.2f} indicates water stress in the crop canopy.",
        })

    # 3. Waterlogging / surface water risk
    if ndwi is not None and ndwi > 0.50 and rain_7d > 35:
        signals.append({
            "type": "warning",
            "icon": "🌊",
            "title": "Possible waterlogging",
            "body": f"NDWI {ndwi:.2f} with {rain_7d}mm in 7 days suggests surface ponding. Check field drainage.",
        })

    # 4. Slow GDD accumulation (temp below seasonal norms)
    gdd_acc = weather.get("gdd_accumulated")
    if gdd_acc is not None and crop_type in CROP_STAGES:
        daily_gdd = weather.get("daily_gdd", [])
        if daily_gdd:
            recent_rate = sum(daily_gdd[-7:]) / 7
            if recent_rate < 3.0:
                signals.append({
                    "type": "info",
                    "icon": "🌡️",
                    "title": "Slow GDD accumulation",
                    "body": f"Average {recent_rate:.1f} GDD/day over last 7 days — cooler than typical. Crop development may be delayed.",
                })

    # 5. Soil pH alert
    if soil and soil.get("ph") is not None:
        ph = soil["ph"]
        if ph < 5.8:
            signals.append({
                "type": "warning",
                "icon": "🧪",
                "title": "Low soil pH",
                "body": f"pH {ph:.1f} — below optimal (6.0–7.0 for most crops). Consider lime application to improve nutrient availability.",
            })
        elif ph > 7.8:
            signals.append({
                "type": "info",
                "icon": "🧪",
                "title": "Alkaline soil",
                "body": f"pH {ph:.1f} — high pH can reduce availability of micronutrients (Fe, Mn, Zn).",
            })

    # 6. Low soil organic matter
    if soil and soil.get("soc_pct") is not None:
        soc = soil["soc_pct"]
        if soc < 1.5:
            signals.append({
                "type": "info",
                "icon": "🌱",
                "title": "Low soil organic matter",
                "body": f"SOC {soc:.1f}% — below 2% threshold. Consider cover cropping or organic amendments to improve soil health.",
            })

    # Fallback: all clear
    if not signals:
        signals.append({
            "type": "positive",
            "icon": "✅",
            "title": "No issues detected",
            "body": "Satellite, weather, and soil indicators are all within normal ranges for the current crop stage.",
        })

    return signals


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/analyse")
async def analyse_context(
    field: FieldFeature,
    ndvi: Optional[float] = Query(None),
    ndmi: Optional[float] = Query(None),
    ndwi: Optional[float] = Query(None),
):
    props = field.properties
    crop_type = props.get("crop_type")
    sowing_date = props.get("sowing_date")

    lat, lng = _centroid(field.geometry.coordinates)

    # Fetch weather + GDD
    weather = {}
    try:
        weather = _fetch_weather(lat, lng, sowing_date)
    except Exception:
        pass

    # Fetch soil (best-effort, slow — don't let it block)
    soil = None
    try:
        soil = _fetch_soil(lat, lng)
    except Exception:
        pass

    # Growth stage
    stage_info = None
    gdd_acc = weather.get("gdd_accumulated")
    if crop_type and crop_type in CROP_STAGES and gdd_acc is not None:
        crop_def = CROP_STAGES[crop_type]
        stage = _resolve_stage(crop_type, gdd_acc)
        if stage and sowing_date:
            sow_date = datetime.strptime(sowing_date, "%Y-%m-%d").date()
            days_since = (date.today() - sow_date).days
            gdd_max = crop_def["stages"][-1]["gdd_max"]
            stage_info = {
                "label": stage["label"],
                "zadoks": stage.get("zadoks"),
                "gdd_accumulated": gdd_acc,
                "gdd_stage_target": stage["gdd_max"],
                "stage_pct": round(_stage_progress(crop_type, gdd_acc), 3),
                "overall_pct": round(_overall_progress(crop_type, gdd_acc), 3),
                "gdd_total_target": gdd_max,
                "crop_name": crop_def["name"],
                "days_since_sowing": days_since,
                "ndvi_expected_lo": stage["ndvi_lo"],
                "ndvi_expected_hi": stage["ndvi_hi"],
            }

    # Rule engine
    stage_for_rules = _resolve_stage(crop_type, gdd_acc) if (crop_type and gdd_acc is not None) else None
    signals = _run_rules(crop_type or "", stage_for_rules, weather, soil, ndvi, ndmi, ndwi)

    return {
        "weather": weather if weather else None,
        "soil": soil,
        "stage": stage_info,
        "signals": signals,
        "crop_name": CROP_DISPLAY_NAMES.get(crop_type) if crop_type else None,
    }
