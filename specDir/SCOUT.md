# Scout — Product Overview

## What is Scout?

Scout is TerraVision's crop health and field intelligence platform for farmers. It takes satellite imagery of a farmer's land, automatically detects field boundaries using AI, analyses crop health through vegetation indices (NDVI/NDRE), and surfaces prioritised, actionable recommendations — telling farmers exactly where to go and what to do to protect yield.

The platform is designed to be accessible to non-technical farmers. Rather than presenting raw satellite data, it translates imagery into plain-language insights with measurable upside metrics (e.g. yield loss prevented, input cost reduction, water savings).

---

## The Three Core Pages

Once onboarded, the app has three main areas accessible via a fixed sidebar:

### Overview (`/overview`)
The farm dashboard. Shows all detected fields on an interactive satellite map, colour-coded by health status (green = Good, yellow = Watch, red = Needs Attention). Includes a stat strip summarising total fields, overall crop health score, fields needing attention, and last scan date. Also shows recent scan history and farm metadata.

### Intelligence (`/intelligence`)
Side-by-side NDVI and NDRE heatmap viewer for any two historical scans. Farmers can compare vegetation index values across different dates, see which zones within a field are stressed, and read auto-generated key insights (e.g. "NDVI declined 12% in the NW zone since last scan"). This is the analytical layer — showing *what* is happening and *where*.

### Action (`/action`)
A prioritised action grid showing the top recommendations for the farm. Each action card includes a priority level (High/Medium), category (Pest/Disease, Irrigation, Nutrition, Monitoring), the specific field and zone to target, a plain-English description of what to do, and an estimated upside metric. Intentionally limited to the top 4 actions for scannability — low-priority items are hidden.

---

## The Onboarding Pipeline (6 Stages)

New users go through a 6-stage setup wizard before reaching the main app. Each stage is sequential and state is held in a central context throughout.

### Stage 1 — Postcode Entry
The farmer types their UK postcode. The app geocodes it via the `postcodes.io` API to get latitude/longitude coordinates.

### Stage 2 — Zoom to Area
The map smoothly flies to the postcode location. A brief loading state shows "Zooming to [Postcode]" while the map recentres. This is a passive transition stage — no user input required.

### Stage 3 — Field Detection
The backend runs a YOLOv11 instance segmentation model (DelineateAnything) on Esri satellite tiles for the visible area. It fetches the satellite mosaic, detects field boundaries, converts them to georeferenced GeoJSON polygons, merges overlapping detections, and filters out anything under 0.25 hectares. The frontend shows an animated "Discovering..." spinner during inference. This is the AI core of Scout.

### Stage 4 — Field Selection
The detected fields are rendered on the map as interactive polygons, and listed in a checkbox sidebar. The farmer selects which fields belong to their farm. At least one field must be selected to continue. This stage handles the case where the AI may detect neighbouring fields the farmer doesn't own.

### Stage 5 — Review & Confirm
A summary of selected fields showing name, area (ha), and perimeter (m). The farmer reviews their selection before committing. A "Confirm & Save" button triggers persistence to the backend.

### Stage 6 — Success
A full-screen success overlay confirms the farm has been saved. A `tv_onboarding_complete` flag is set in localStorage so returning users skip onboarding. The farmer is then redirected to `/overview`.

---

## Tech Summary

| Layer | Stack |
|---|---|
| Frontend | React 19 + TypeScript + Vite + TanStack Router |
| Styling | Tailwind CSS v4 + Flowbite React |
| Maps | Leaflet + Esri satellite tiles |
| Backend | FastAPI (Python) |
| Field detection ML | YOLOv11 DelineateAnything |
| Geospatial processing | geopandas, shapely, rasterio, mercantile |
| Data persistence | JSON files on disk (per farm) |

---

## Data Flow (End-to-End)

```
Farmer enters postcode
  → Geocoded to lat/lng
  → Map flies to location
  → YOLOv11 runs on satellite tiles → returns GeoJSON field polygons
  → Farmer selects their fields
  → Selected fields saved to disk as {farm_id}.geojson + {farm_id}.json
  → Farmer redirected to /overview
  → App loads farm data; farmer navigates Overview → Intelligence → Action
```
