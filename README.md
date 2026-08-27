# TerraVision Scout

Crop health and field intelligence platform.

## Quick Start

```bash
./startApp.sh
```

This starts both the client and server. Open http://localhost:5173.

## Manual Setup

### Server

```bash
cd server
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn main:app --reload
```

Runs on http://localhost:8000.

The first field detection request will download the DelineateAnything model (~120MB).

### Client

```bash
cd client
npm install
npm run dev
```

Runs on http://localhost:5173 with API proxy to the server.

## Structure

```
client/                  React + TypeScript + Vite
  src/
    routes/              TanStack Router file-based routes
    pages/
      onboarding/        Onboarding wizard (postcode → detect fields → select → confirm)
      overview/          Farm dashboard
    layers/
      intelligence/      Field intelligence analysis
      action/            Action recommendations
    components/
      map/               Shared Leaflet map components
      layout/            App shell (sidebar, header)
    api/                 API client modules
    types/               Shared TypeScript types

server/                  FastAPI + Python
  main.py               App entry point
  intelligence.py        Crop intelligence analysis
  routers/
    fields.py            POST /api/fields/detect (ML field boundary detection)
    onboarding.py        POST /api/onboarding/save
  services/
    field_generator.py   DelineateAnything (YOLOv11) inference
  models/
    schemas.py           Pydantic request/response models
```
