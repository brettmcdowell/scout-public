export interface Zone {
  id: string
  name: string
  severity: 'Very High' | 'High' | 'Moderate' | 'Low' | 'Improving'
  areaHa: number
  trend: 'worsened' | 'stable' | 'improving'
}

export interface AnalysisStats {
  cropHealthScore: number
  ndreScore: number
  ndmiScore: number | null
  eviScore: number | null
  ndwiScore: number | null
  variScore: number
  maxScore: number
  scoreLabel: string
  abnormalZones: number
  affectedAreaHa: number
  affectedAreaPct: number
  trend: string
  trendDelta: string
  topPriority: string
  topPriorityLevel: string
}

export interface Scene {
  date: string
  cloud_cover: number
}

export interface DetectedSignal {
  icon: string
  title: string
  description: string
  severity: 'High' | 'Medium' | 'Low'
}

export interface AnalysisData {
  ndvi_overlay: string | null       // S2 NDVI — null if S2 unavailable for this date
  ndre_overlay: string | null       // S2 NDRE — null if S2 unavailable
  ndmi_overlay: string | null       // S2 NDMI (moisture) — null if S2 unavailable
  evi_overlay: string | null        // S2 EVI — null if S2 unavailable
  ndwi_overlay: string | null       // S2 NDWI (water) — null if S2 unavailable
  vari_overlay: string | null       // Esri VARI (high-res, always available)
  rgb_overlay: string | null        // Esri RGB tiles
  actual_scene_date: string | null
  bounds: [[number, number], [number, number]]          // Esri bounds (VARI / RGB)
  ndvi_bounds: [[number, number], [number, number]] | null  // S2 bounds (NDVI / NDRE)
  zones: Zone[]
  stats: AnalysisStats
  detected_signals: DetectedSignal[]
  vegetation_layer: string
}

export const SEVERITY_COLOURS: Record<string, string> = {
  'Very High': '#ef4444',
  High: '#f97316',
  Moderate: '#eab308',
  Low: '#a855f7',
  Improving: '#22c55e',
}

export const MOCK_FIELD_GEOJSON = {
  type: 'Feature' as const,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [[
      [-1.2345, 51.5672],
      [-1.2345, 51.5692],
      [-1.2308, 51.5692],
      [-1.2308, 51.5672],
      [-1.2345, 51.5672],
    ]],
  },
  properties: { fieldName: 'North Pasture', areaHa: 12.4 },
}
