# TerraVision Scout — Design System

> This document describes the **actual built design** as of May 2026. Use it as the reference spec to recreate or extend the UI with a new agent.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + TypeScript + Vite |
| Routing | TanStack Router (file-based, `src/routes/`) |
| UI component library | Flowbite React v0.12 (primary) |
| Styling | Tailwind CSS v4 — CSS-based config (`@theme`, `@plugin`, `@source` in `index.css`) |
| Icons | `react-icons/hi` (HeroIcons v1 only — `Hi` prefix) |
| Backend | Python FastAPI (`server/`) |

> **Flowbite note:** Use Flowbite React components (Card, Badge, Avatar, Modal) wherever they fit cleanly. Use native HTML elements (`<select>`, `<button>`) when Flowbite's wrapper causes layout issues — e.g. Flowbite `<Tooltip>` breaks flex centering; Flowbite `<Select>` auto-sizes too narrow for single-character values.

---

## Colour Palette

| Role | Tailwind class | Hex | Usage |
|---|---|---|---|
| Active nav border + icon | `green-600` / `green-700` | `#16a34a` / `#15803d` | Left border of active sidebar item, active icon |
| Active nav background | `green-50` | `#f0fdf4` | Background of active sidebar item |
| Page background | `gray-50` | `#f9fafb` | App shell background |
| Card / sidebar surface | `white` | `#ffffff` | All card and panel backgrounds |
| Border | `gray-200` | `#e5e7eb` | All card borders, sidebar/header borders |
| Text — primary | `gray-900` | `#111827` | Numbers, headings, action titles |
| Text — secondary | `gray-700` | `#374151` | Body copy |
| Text — muted | `gray-500` / `gray-400` | `#6b7280` / `#9ca3af` | Sub-labels, captions, section caps |
| Good / healthy | `green-600` | `#16a34a` | Field status "Good", NDVI high values |
| Watch | `yellow-600` | `#ca8a04` | Field status "Watch" |
| Needs Attention | `red-600` | `#dc2626` | Field status "Needs Attention" |
| Download CTA | `green-600 → green-700` gradient | — | Download Full Action Report button card |

### Priority Colours (Action Page)

| Priority | Dot | Pill background | Accent bar |
|---|---|---|---|
| High | `bg-red-500` | `bg-red-50 text-red-700 border-red-200` | `bg-red-500` |
| Medium | `bg-yellow-400` | `bg-yellow-50 text-yellow-700 border-yellow-200` | `bg-yellow-400` |
| Low | `bg-gray-400` | `bg-gray-50 text-gray-500 border-gray-200` | `bg-gray-400` |

### NDVI Colour Scale

| NDVI range | Colour |
|---|---|
| < 0.10 | `#7f0000` (dark red) |
| 0.10–0.20 | `#c62828` |
| 0.20–0.30 | `#ef4444` |
| 0.30–0.40 | `#f97316` (orange) |
| 0.40–0.50 | `#eab308` (yellow) |
| 0.50–0.60 | `#a3e635` (yellow-green) |
| 0.60–0.70 | `#4ade80` |
| 0.70–0.80 | `#22c55e` |
| > 0.80 | `#15803d` (dark green) |

Gradient string (left → right, 0.0 → 1.0):
```
linear-gradient(to right, #7f0000, #ef4444, #f97316, #eab308, #a3e635, #22c55e, #15803d)
```

### NDRE Colour Scale

| NDRE range | Colour |
|---|---|
| < 0.15 | `#9333ea` (purple) |
| 0.15–0.25 | `#ec4899` (pink) |
| 0.25–0.35 | `#f97316` |
| 0.35–0.50 | `#eab308` |
| 0.50–0.65 | `#84cc16` |
| 0.65–0.80 | `#22c55e` |
| > 0.80 | `#15803d` |

Gradient string:
```
linear-gradient(to right, #9333ea, #ec4899, #f97316, #eab308, #84cc16, #22c55e, #15803d)
```

---

## Typography

No custom font import — system/Tailwind defaults apply. All sizes are Tailwind utility classes.

| Role | Class | Notes |
|---|---|---|
| Page section label | `text-sm font-semibold text-gray-400 tracking-wide` | Top of every page, e.g. "Overview", "Intelligence" |
| Stat number (large) | `text-2xl font-bold text-gray-900` | Stat strip values |
| Stat number (medium) | `text-base font-bold text-gray-900` | Right panel comparison values |
| Section caps | `text-[10px] font-semibold text-gray-500 uppercase tracking-wider` | Card section titles |
| Body / detail | `text-xs text-gray-500 leading-relaxed` | Description text in cards |
| Field label | `text-xs font-semibold` | With status colour class |
| Hero action title | `text-2xl font-bold text-gray-900 leading-snug` | Action card main text |
| Upside value | `text-2xl font-bold text-green-700` | Action card bottom metric |
| On-image badge | `text-xs font-semibold px-2 py-1 rounded-md bg-black/70 text-white` | Scan label overlaid on field image |

---

## Layout Shell

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR  56 px fixed, white, border-r border-gray-200     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Logo  (scoutLogo.png, h-7 w-7, centred)            │  │
│  │  border-b border-gray-100                           │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Nav items (icon only, centred)                      │  │
│  │  Active: bg-green-50, border-l-[3px] border-green-600│  │
│  │  Inactive: text-gray-400, hover:bg-gray-50           │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  Avatar (AG initials) → opens Account Modal          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  MAIN AREA  flex-1, overflow-hidden                        │
│  Each page manages its own internal layout                 │
└────────────────────────────────────────────────────────────┘
```

- **No app header** — page identity comes from the small section label at top-left of content
- **Sidebar is always 56 px** — never collapses, never has a toggle
- **Nav uses native `title` attribute** for tooltips — NOT Flowbite `<Tooltip>` (it breaks icon centering)
- **Avatar modal** uses Flowbite `<Modal>` with disabled Settings and Log Out buttons

```tsx
// AppLayout.tsx
<div className="flex h-screen overflow-hidden bg-gray-50">
  <AppSidebar />
  <main className="flex-1 min-w-0 overflow-hidden">
    <Outlet />
  </main>
</div>
```

---

## Shared Component Patterns

### Stat Strip Card

Used on Overview, Intelligence (implied), and Action pages.

```tsx
<div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
  <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
  <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
</div>
```

Grid: `grid grid-cols-4 gap-3`

### Download CTA Card (Action page — 4th stat card slot)

```tsx
<button className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl px-4 py-3 text-left transition-colors flex flex-col justify-between">
  <div className="flex items-center justify-between">
    <p className="text-[10px] font-medium text-green-200 uppercase tracking-wide">{date}</p>
    <HiDownload className="w-4 h-4 text-green-200" />
  </div>
  <div className="mt-1">
    <p className="text-base font-bold text-white leading-tight">Download Full</p>
    <p className="text-sm font-semibold text-green-200 leading-tight">Action Report</p>
  </div>
</button>
```

### Field Image with Heatmap Overlay

Field images live at `/public/fields/field1.png` through `field6.png`. The overview map is `/public/fields/all.png`.

Heatmap blobs are `position: absolute` divs using CSS radial gradients:
```tsx
background: `radial-gradient(ellipse at center, ${color}cc 0%, ${color}66 50%, transparent 82%)`
```
Each blob is sized with `width: ${z.rx * 2.8}%` / `height: ${z.ry * 2.8}%` and centred with `transform: translate(-50%, -50%)`.

### On-Image Date Selector

```tsx
<select
  value={scanId}
  onChange={(e) => onScanChange(e.target.value as ScanId)}
  className="bg-black/50 backdrop-blur-sm text-gray-200 text-[10px] font-medium px-2 py-1 rounded-md border-0 cursor-pointer focus:outline-none"
  style={{ colorScheme: 'dark' }}
>
  {SCANS.map((s) => (
    <option key={s.id} value={s.id} style={{ background: '#111827', color: '#e5e7eb' }}>
      {s.label.split(' (')[0]}
    </option>
  ))}
</select>
```

### Horizontal NDVI/NDRE Scale Bar (overlaid on image, bottom)

```tsx
<div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-2.5 pt-6 bg-gradient-to-t from-black/60 to-transparent">
  <div className="h-2.5 w-full rounded-full" style={{ background: GRADIENT_STRING }} />
  <div className="flex justify-between mt-1">
    {['0.0','0.2','0.4','0.6','0.8','1.0'].map((v) => (
      <span key={v} className="text-[8px] text-white/75 font-medium leading-none">{v}</span>
    ))}
  </div>
</div>
```

### Layer Toggle (RGB / NDVI / NDRE)

```tsx
<div className="flex rounded-lg border border-gray-300 overflow-hidden">
  {(['RGB', 'NDVI', 'NDRE'] as VegLayer[]).map((v) => (
    <button
      key={v}
      onClick={() => setLayer(v)}
      className={[
        'px-3 py-1.5 text-xs font-medium transition-colors',
        layer === v ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
      ].join(' ')}
    >
      {v}
    </button>
  ))}
</div>
```

---

## Page Designs

### Overview (`/overview`)

**Layout:** full-height flex column with no scroll at the page level.

```
px-5 pt-4 pb-0 flex flex-col gap-3

  [Page label] "Overview"  text-sm font-semibold text-gray-400

  [Stat strip]  grid grid-cols-4 gap-3  (4 cards)
    Total Fields · Crop Health · Needs Attention · Last Scan Status

  [Tabbed main area]  flex-1 min-h-0, bg-white rounded-xl border
    Tabs: Farm Overview | Recent Scans | Farm Summary

    Farm Overview tab:
      - all.png as base image (w-full h-full object-cover)
      - Field labels absolutely positioned using posX/posY percentages
        → transform: translate(-50%, -50%) to centre on coordinate
      - Clicking label → zoom animation + stats panel slides in from right
      - Back arrow (HiArrowLeft) top-left when zoomed

    Recent Scans tab:
      - Custom accordion, one item per scan date

    Farm Summary tab:
      - Key-value rows: Crop Health Score, Fields Requiring Attention, Last Scan Status
```

**Zoom animation (field → individual field image):**
```tsx
// Two-step: mount at scale(0.15), then 20ms later set animIn=true to trigger transition
style={{
  transformOrigin: `${field.posX} ${field.posY}`,  // dives from the label's position
  transform: animIn ? 'scale(1)' : 'scale(0.15)',
  opacity: animIn ? 1 : 0,
  filter: animIn ? 'blur(0px)' : 'blur(10px)',
  transition: 'transform 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.5s ease, filter 0.5s ease',
}}

// Overview image fades/blurs simultaneously:
style={{
  opacity: selected ? 0 : 1,
  filter: (selected && animIn) ? 'blur(4px)' : 'blur(0px)',
  transition: 'opacity 0.5s ease, filter 0.5s ease',
}}
```

Back: set `animIn=false`, wait 650 ms, then set `selected=null`.

**Field positions (absolute % within all.png):**
| Field | posX | posY | Status |
|---|---|---|---|
| Field 1 | 15% | 28% | Good |
| Field 2 | 40% | 28% | Good |
| Field 3 | 70% | 27% | Needs Attention |
| Field 4 | 11% | 70% | Watch |
| Field 5 | 50% | 72% | Good |
| Field 6 | 87% | 72% | Good |

---

### Intelligence (`/intelligence`)

**Layout:** full-height flex column, no page scroll.

```
px-5 pt-4 pb-4 flex flex-col gap-3

  [Page label] "Intelligence"

  [Controls bar]  flex items-center gap-3
    Field selector (native <select>, min-w-[52px], options "1"–"6")
    Inline: "Field" label · status text · "18.2 ha · Winter Wheat"
    Layer toggle: RGB / NDVI / NDRE

  [Main area]  flex-1 min-h-0 flex gap-3
    [Dual maps]  flex-1 grid grid-cols-2 gap-3
      Each: FieldHeatmapView component
        - field image as base
        - NDVI/NDRE radial-gradient blobs overlaid
        - Top-left: "Scan A/B" badge + dark date <select>
        - Top-right: NDVI avg badge (when not RGB)
        - Bottom: horizontal colour scale bar (when not RGB)

    [Insights panel]  w-64 flex-shrink-0
      5 stacked cards (no accordion, always expanded, compact padding):
        1. NDVI Comparison   — 2 stat boxes + change row
        2. NDRE Comparison   — 2 stat boxes + change row
        3. Stress Coverage   — 2 stat boxes + change row
        4. Zone Comparison   — compact table (zone label, Scan A value, Scan B value)
        5. Key Insights      — 3 bullet points with colour-coded dots
```

**Zone position labels** derived from `cx`/`cy` percentages:
- cx < 35% → W, cx > 65% → E, else centre column
- cy < 35% → N, cy > 65% → S, else centre row
- Combine: "NW", "N", "NE", "W", "Centre", "E", "SW", "S", "SE"

**NDRE values** derived from NDVI zone data:
```ts
v_ndre = Math.max(0, Math.min(1, z.v * 0.82 + 0.08 + (i % 2 === 0 ? 0.04 : -0.04)))
```

**Scan dates available:**
- May 14, 2026 (Current)
- Apr 27, 2026 (Baseline)
- Apr 06, 2026
- Mar 16, 2026

---

### Action (`/action`)

**Layout:** full-height flex column, no page scroll.

```
px-5 pt-4 pb-4 flex flex-col gap-3

  [Page label] "Action"

  [Stats strip]  grid grid-cols-4 gap-3
    High Priority · Est. Value at Risk · Fields Affected
    + green gradient "Download Full Action Report" CTA card

  [2×2 action grid]  flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-3
    Top 4 priority actions (High first, then Medium)
```

**Action card structure:**
```
┌─────────────────────────────────────────────────┐
│ [thin coloured accent bar at top — red/yellow]  │
│                                                 │
│  p-6 flex flex-col                              │
│  ┌ header ─────────────────────────────────┐    │
│  │ [priority dot] [Priority pill]  [Category tag + icon] │
│  └──────────────────────────────────────────┘   │
│  Field X · Zone Name        text-sm gray-400     │
│  Action title               text-2xl font-bold   │
│  Detail description         text-sm gray-500     │
│  (flex-1 — pushes upside to bottom)              │
│  ─────────────────────────────────────────────   │
│  ↑ Upside label             £820 / ~8% / +0.28  │
│    text-sm gray-500         text-2xl green-700   │
└─────────────────────────────────────────────────┘
```

**Category tags with icons:**
| Category | Icon | Colour |
|---|---|---|
| Pest / Disease | HiExclamation | `text-red-500 bg-red-50` |
| Irrigation | HiRefresh | `text-blue-500 bg-blue-50` |
| Nutrition | HiBeaker | `text-purple-500 bg-purple-50` |
| Monitoring | HiEye | `text-gray-500 bg-gray-50` |

---

## Spacing & Radius Reference

| Token | Value | Usage |
|---|---|---|
| Card radius | `rounded-xl` | All cards and panels |
| Button radius | `rounded-lg` | Toggle buttons, layer selectors |
| Page padding (h) | `px-5` | All pages |
| Page padding (v) | `pt-4 pb-4` | All pages |
| Gap between major sections | `gap-3` | Flex column page layouts |
| Stat strip gap | `gap-3` | 4-col grid |
| Card inner padding (standard) | `p-2` to `p-2.5` | Right panel cards |
| Card inner padding (action cards) | `p-6` | 2×2 action grid cards |
| Right panel width (Intelligence) | `w-64` | Fixed, no scroll |
