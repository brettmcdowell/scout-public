# TerraVision Scout — Onboarding Layer Spec

> How to build the Onboarding flow and wire it into the existing app. Read STRUCTURE.md first.

---

## Purpose

Onboarding is the entry step that produces the field data all other layers consume. It collects a farm location, fetches satellite imagery, lets the user draw or confirm field boundaries, and writes the result into app state. Once complete it redirects to `/overview`.

---

## Flow (step by step)

```
/onboarding
  1. Postcode entry      → geocode to lat/lng
  2. Satellite preview   → show Esri World Imagery tile centred on location
  3. Lock area of interest → user draws a rectangle bounding box
  4. Field detection     → POST bounding box to /api/sensing/detect-fields
                           returns GeoJSON FeatureCollection (one Feature per field)
  5. Field confirmation  → user sees detected field polygons overlaid on imagery,
                           can deselect any, then clicks "Confirm fields"
  6. Write to state      → save FeatureCollection to app-level context/store
  7. Redirect            → push to /overview
```

---

## What It Produces

A **GeoJSON FeatureCollection** — one `Feature` per confirmed field, each with:

```json
{
  "type": "Feature",
  "geometry": { "type": "Polygon", "coordinates": [[...]] },
  "properties": {
    "id": "field-1",
    "name": "Field 1",
    "areaha": 18.2,
    "crop": "Winter Wheat"
  }
}
```

This is the contract. Everything downstream (Intelligence, Action, Overview field list) reads from this object.

---

## Where to Plug In

| File | Change needed |
|---|---|
| `src/routes/onboarding.tsx` | Replace stub with `<OnboardingPage />` import |
| `src/layers/onboarding/OnboardingPage.tsx` | Create — houses all step UI |
| `src/routes/index.tsx` | Change redirect from `/overview` to `/onboarding` for first-time users (check if FeatureCollection exists in store) |
| `src/routes/__root.tsx` | Add onboarding to nav only if needed (currently hidden from sidebar) |

---

## State / Storage

Store the confirmed FeatureCollection in a React context (or Zustand store) at the app root so all routes can read it. A simple approach for MVP:

```ts
// src/context/FarmContext.tsx
const FarmContext = createContext<{
  fields: GeoJSON.FeatureCollection | null
  setFields: (fc: GeoJSON.FeatureCollection) => void
}>({ fields: null, setFields: () => {} })
```

Wrap `<RouterProvider>` with `<FarmProvider>`. All pages read from `useFarm().fields`.

For persistence across refreshes: `localStorage.setItem('farm-fields', JSON.stringify(fc))` on confirm, rehydrate in the provider's `useState` initialiser.

---

## Backend Endpoint Needed

```
POST /api/sensing/detect-fields
Body:  { bbox: [west, south, east, north] }  // WGS84 lat/lng
Returns: GeoJSON FeatureCollection
```

For MVP this can return mock polygons derived from the bounding box. Add the route to `server/main.py` alongside the existing CORS setup.

---

## Satellite Imagery

Use the same tile source already referenced in DESIGN.md:
```
https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
```
No API key required. Render via `react-leaflet` `<TileLayer>` — the one place a map library is appropriate (user needs to draw on live imagery).

---

## Sidebar behaviour during onboarding

Onboarding should **not** show the sidebar. Wrap the route differently:

```tsx
// src/routes/__root.tsx — add a condition:
// If pathname === '/onboarding', render <Outlet /> without <AppLayout>
```

Or use a nested route layout that omits the sidebar for the `/onboarding` segment.

---

## Definition of Done

- User can enter a postcode, see imagery, confirm fields
- `FarmContext` holds a valid FeatureCollection after completion
- `/overview` stat strip reads field count from context (replaces hardcoded `6`)
- `/intelligence` field selector is populated from context field names
- `/action` field references match context field ids
