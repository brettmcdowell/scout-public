export interface WeatherData {
  rain_7d: number
  temp_avg_7d: number
  forecast_rain_3d: number
  daily_precipitation: number[]
  gdd_accumulated: number | null
  daily_gdd: number[]
}

export interface SoilData {
  clay_pct: number | null
  silt_pct: number | null
  sand_pct: number | null
  ph: number | null
  soc_pct: number | null
}

export interface GrowthStageInfo {
  label: string
  zadoks: string | null
  gdd_accumulated: number
  gdd_stage_target: number
  gdd_total_target: number
  stage_pct: number
  overall_pct: number
  crop_name: string
  days_since_sowing: number
  ndvi_expected_lo: number
  ndvi_expected_hi: number
}

export interface ContextSignal {
  type: 'warning' | 'info' | 'positive'
  icon: string
  title: string
  body: string
}

export interface ContextData {
  weather: WeatherData | null
  soil: SoilData | null
  stage: GrowthStageInfo | null
  signals: ContextSignal[]
  crop_name: string | null
}

export const CROP_OPTIONS = [
  { value: '', label: 'No crop set' },
  { value: 'winter_wheat', label: 'Winter Wheat' },
  { value: 'winter_barley', label: 'Winter Barley' },
  { value: 'oilseed_rape', label: 'Oilseed Rape' },
  { value: 'spring_barley', label: 'Spring Barley' },
  { value: 'spring_wheat', label: 'Spring Wheat' },
  { value: 'potatoes', label: 'Potatoes' },
  { value: 'sugar_beet', label: 'Sugar Beet' },
  { value: 'maize', label: 'Maize' },
  { value: 'grassland', label: 'Grassland / Pasture' },
  { value: 'other', label: 'Other' },
]
