import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, ImageOverlay, GeoJSON, CircleMarker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { AnalysisData } from './types'
import { SEVERITY_COLOURS, MOCK_FIELD_GEOJSON } from './types'

// Zone centres within the mock field bounding box
const ZONE_CENTRES: Record<string, [number, number]> = {
  A: [51.5686, -1.2338],
  B: [51.5681, -1.2318],
  C: [51.5675, -1.2338],
  D: [51.5675, -1.2326],
  E: [51.5686, -1.2314],
}

const ESRI_AERIAL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_ATTR = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye'

// Legend
const LEGEND_ITEMS = [
  { label: 'Very High', color: '#ef4444' },
  { label: 'High', color: '#f97316' },
  { label: 'Moderate', color: '#eab308' },
  { label: 'Low', color: '#a855f7' },
  { label: 'Improving', color: '#22c55e' },
]

interface Props {
  analysisData: AnalysisData | null
  vegLayer: 'RGB' | 'NDVI' | 'NDRE'
}

function ZoneMarkers({ zones }: { zones: AnalysisData['zones'] }) {
  return (
    <>
      {zones.map((z) => {
        const pos = ZONE_CENTRES[z.id]
        if (!pos) return null
        const color = SEVERITY_COLOURS[z.severity]
        return (
          <CircleMarker
            key={z.id}
            center={pos}
            radius={18}
            pathOptions={{ fillColor: color, color: '#fff', fillOpacity: 1, weight: 2 }}
          >
            <Tooltip permanent direction="center" offset={[0, 0]} className="zone-id-label">
              <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{z.id}</span>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}

export function FieldIntelligenceMap({ analysisData, vegLayer }: Props) {
  const fieldBounds = analysisData?.bounds ?? [[51.5672, -1.2345], [51.5692, -1.2308]]
  const centre: [number, number] = [
    (fieldBounds[0][0] + fieldBounds[1][0]) / 2,
    (fieldBounds[0][1] + fieldBounds[1][1]) / 2,
  ]

  return (
    <div>
      {/* Map header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Field Intelligence Map</h2>
        <div className="flex items-center gap-3">
          {LEGEND_ITEMS.map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
              <span className="text-xs text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leaflet map */}
      <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 420 }}>
        <MapContainer
          center={centre}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer url={ESRI_AERIAL} attribution={ESRI_ATTR} maxZoom={20} />

          {/* Field polygon outline */}
          <GeoJSON
            data={MOCK_FIELD_GEOJSON as GeoJSON.Feature}
            style={{ color: '#16a34a', weight: 2, fillOpacity: 0, dashArray: '4 4' }}
          />

          {/* NDVI/NDRE overlay — only shown when not in RGB mode */}
          {vegLayer !== 'RGB' && analysisData?.ndvi_overlay && (
            <ImageOverlay
              url={analysisData.ndvi_overlay}
              bounds={fieldBounds}
              opacity={0.85}
            />
          )}

          {/* Zone markers */}
          {analysisData?.zones && <ZoneMarkers zones={analysisData.zones} />}
        </MapContainer>
      </div>
    </div>
  )
}
