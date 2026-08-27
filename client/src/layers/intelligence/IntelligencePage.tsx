import { useState, useEffect, useRef, type MutableRefObject, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { HiTrendingDown, HiTrendingUp, HiMinus } from 'react-icons/hi'
import { MapContainer, TileLayer, Polygon, SVGOverlay, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useFarm } from '../../contexts/FarmContext'
import type { FieldFeature } from '../../types/geo'
import type { AnalysisData, Scene } from './types'
import type { ContextData } from '../context/types'
import { getCachedEntry, getMemoizedAnalysis, memoizeAnalysis } from '../../lib/analysisCache'
import { ESRI_SATELLITE_URL } from '../../components/map/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type VegLayer = 'RGB' | 'NDVI' | 'NDRE' | 'NDMI' | 'EVI' | 'NDWI' | 'VARI'
type MetricTab = 'NDVI' | 'NDRE' | 'NDMI' | 'EVI' | 'NDWI' | 'VARI'

function Spinner({ size = 'sm', className = '' }: { size?: 'sm' | 'lg'; className?: string }) {
  const sz = size === 'lg' ? 'w-7 h-7 border-[3px]' : 'w-4 h-4 border-2'
  return (
    <div className={`animate-spin rounded-full border-gray-200 border-t-gray-400 mx-auto ${sz} ${className}`} />
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_ORDER = ['Improving', 'Low', 'Moderate', 'High', 'Very High']

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function zoneAbbr(name: string): string {
  return name.replace('North-', 'N').replace('South-', 'S').replace('West', 'W').replace('East', 'E')
}

// ─── Insight generation ────────────────────────────────────────────────────────

type Insight = { text: string; type: 'warning' | 'positive' | 'neutral' }

function generateInsights(dataA: AnalysisData, dataB: AnalysisData): Insight[] {
  const deltaScore = dataA.stats.cropHealthScore - dataB.stats.cropHealthScore
  const stressDelta = dataA.stats.affectedAreaPct - dataB.stats.affectedAreaPct
  const out: Insight[] = []

  if (deltaScore < -8)
    out.push({ text: `Health score fell ${Math.abs(deltaScore)} pts — significant deterioration between scans.`, type: 'warning' })
  else if (deltaScore > 5)
    out.push({ text: `Health score improved ${deltaScore} pts — positive recovery trend.`, type: 'positive' })
  else
    out.push({ text: `Health score stable (${deltaScore > 0 ? '+' : ''}${deltaScore} pts) — field largely unchanged.`, type: 'neutral' })

  if (stressDelta > 10)
    out.push({ text: `Stressed area grew ${stressDelta.toFixed(1)}pp — rapid spread, check for systemic issue.`, type: 'warning' })
  else if (stressDelta < -5)
    out.push({ text: `Stressed area reduced ${Math.abs(stressDelta).toFixed(1)}pp — treatment taking effect.`, type: 'positive' })
  else
    out.push({ text: `Stress coverage ${stressDelta >= 0 ? 'up' : 'down'} ${Math.abs(stressDelta).toFixed(1)}pp — monitor next scan.`, type: 'neutral' })

  const worseZones = dataA.zones.filter((zA) => {
    const zB = dataB.zones.find((z) => z.name === zA.name)
    return zB && SEVERITY_ORDER.indexOf(zA.severity) > SEVERITY_ORDER.indexOf(zB.severity)
  })
  if (worseZones.length > 0)
    out.push({ text: `${worseZones.map((z) => zoneAbbr(z.name)).join(' & ')} deteriorated since previous scan.`, type: 'warning' })
  else if (dataA.stats.abnormalZones === 0)
    out.push({ text: 'All zones within normal range in current scan.', type: 'positive' })
  else
    out.push({ text: `${dataA.stats.abnormalZones} zone(s) need attention — prioritise scouting.`, type: 'neutral' })

  return out.slice(0, 3)
}

// ─── Map sync ─────────────────────────────────────────────────────────────────

function SyncMaps({
  mapRef,
  otherRef,
  syncingRef,
}: {
  mapRef: MutableRefObject<L.Map | null>
  otherRef: MutableRefObject<L.Map | null>
  syncingRef: MutableRefObject<boolean>
}) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map
    return () => { mapRef.current = null }
  }, [map, mapRef])

  useEffect(() => {
    const sync = () => {
      if (syncingRef.current) return
      const other = otherRef.current
      if (!other) return
      syncingRef.current = true
      other.setView(map.getCenter(), map.getZoom(), { animate: false })
      syncingRef.current = false
    }
    map.on('move', sync)
    return () => { map.off('move', sync) }
  }, [map, otherRef, syncingRef])

  return null
}

// ─── ClippedImageOverlay ──────────────────────────────────────────────────────
// Uses an SVG clipPath matching the field polygon so the heatmap is
// clipped exactly to the field boundary rather than relying on the PNG's
// rasterised alpha mask (which can bleed 1-2 pixels outside the outline).

function ClippedImageOverlay({
  url,
  bounds,
  positions,
  clipId,
}: {
  url: string
  bounds: [[number, number], [number, number]]
  positions: [number, number][]   // [lat, lng] pairs (Leaflet order)
  clipId: string
}) {
  const [[south, west], [north, east]] = bounds
  // Map lat/lng → SVG units (0-1000 viewBox). Linear mapping is accurate at
  // field scale; Mercator distortion over a ~1 km² area is negligible.
  const pts = positions
    .map(([lat, lng]) => {
      const x = ((lng - west) / (east - west) * 1000).toFixed(2)
      const y = ((north - lat) / (north - south) * 1000).toFixed(2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <SVGOverlay
      bounds={bounds}
      attributes={{ viewBox: '0 0 1000 1000', preserveAspectRatio: 'none' }}
    >
      <defs>
        <clipPath id={clipId}>
          <polygon points={pts} />
        </clipPath>
      </defs>
      {/* SVG <image> clips to the polygon; no PNG alpha edge artefacts */}
      <image
        href={url}
        x="0" y="0" width="1000" height="1000"
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="none"
      />
    </SVGOverlay>
  )
}

// ─── FieldHeatmapView ─────────────────────────────────────────────────────────

function FieldFitBounds({ feature, fieldIdx }: { feature: FieldFeature; fieldIdx: number }) {
  const map = useMap()
  useEffect(() => {
    const pts = feature.geometry.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng))
    map.fitBounds(L.latLngBounds(pts), { padding: [16, 16] })
  }, [fieldIdx, map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function FieldHeatmapView({
  fieldIdx,
  fieldFeature,
  scenes,
  selectedDate,
  onDateChange,
  layer,
  scanLabel,
  analysisData,
  isAnalysing,
  noSpectralDates,
  mapRef,
  otherMapRef,
  syncingRef,
}: {
  fieldIdx: number
  fieldFeature: FieldFeature | null
  scenes: Scene[]
  selectedDate: string | null
  onDateChange: (date: string) => void
  layer: VegLayer
  scanLabel: string
  analysisData: AnalysisData | null
  isAnalysing: boolean
  noSpectralDates: Set<string>
  mapRef: MutableRefObject<L.Map | null>
  otherMapRef: MutableRefObject<L.Map | null>
  syncingRef: MutableRefObject<boolean>
}) {
  const imgNum = (fieldIdx % 6) + 1
  const overlayUrl = layer === 'NDRE' ? analysisData?.ndre_overlay
    : layer === 'RGB'  ? analysisData?.rgb_overlay ?? undefined
    : layer === 'NDMI' ? analysisData?.ndmi_overlay
    : layer === 'EVI'  ? analysisData?.evi_overlay
    : layer === 'NDWI' ? analysisData?.ndwi_overlay
    : layer === 'VARI' ? analysisData?.vari_overlay
    : analysisData?.ndvi_overlay
  const scoreForLayer = analysisData ? (
    layer === 'NDRE' ? analysisData.stats.ndreScore
    : layer === 'NDMI' ? analysisData.stats.ndmiScore
    : layer === 'EVI'  ? analysisData.stats.eviScore
    : layer === 'NDWI' ? analysisData.stats.ndwiScore
    : layer === 'VARI' ? analysisData.stats.variScore
    : analysisData.stats.cropHealthScore
  ) : null
  const displayAvg = scoreForLayer != null ? (scoreForLayer / 100).toFixed(2) : null
  const overlayBounds = analysisData
    ? (layer === 'RGB' || layer === 'VARI') ? analysisData.bounds : (analysisData.ndvi_bounds ?? analysisData.bounds)
    : null

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-900 h-full">
      {fieldFeature ? (
        <MapContainer
          style={{ width: '100%', height: '100%' }}
          center={[51.5, -0.1]}
          zoom={14}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url={ESRI_SATELLITE_URL} maxZoom={20} />
          <Polygon
            positions={fieldFeature.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{ color: '#ffffff', weight: 1.5, fillOpacity: 0, dashArray: '4 4' }}
          />
          <FieldFitBounds feature={fieldFeature} fieldIdx={fieldIdx} />
          <SyncMaps mapRef={mapRef} otherRef={otherMapRef} syncingRef={syncingRef} />
          {overlayUrl && overlayBounds && fieldFeature && (
            <ClippedImageOverlay
              key={overlayUrl}
              url={overlayUrl}
              bounds={overlayBounds}
              positions={fieldFeature.geometry.coordinates[0].map(
                ([lng, lat]) => [lat, lng] as [number, number]
              )}
              clipId={`field-clip-${scanLabel.replace(/\s+/g, '-').toLowerCase()}`}
            />
          )}
        </MapContainer>
      ) : (
        <img src={`/fields/field${imgNum}.png`} alt="" className="w-full h-full object-cover" />
      )}

      {/* Loading overlay — dark green with spinner, held until both scans done */}
      {isAnalysing && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
          style={{ background: 'rgba(20, 60, 30, 0.72)' }}>
          <Spinner size="lg" className="border-white/30 border-t-white/90" />
          <span className="text-white/90 text-xs font-medium tracking-wide">Analysing field…</span>
        </div>
      )}
      {/* S2 unavailable notice */}
      {!isAnalysing && analysisData && (layer === 'NDVI' || layer === 'NDRE') && !overlayUrl && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="bg-black/70 backdrop-blur-sm text-gray-300 text-[10px] font-medium px-3 py-1.5 rounded-lg">
            S2 data unavailable for this date
          </span>
        </div>
      )}

      {/* Top-left: label + date selector */}
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1">
        <div className="flex gap-1.5 items-center">
        <span className="bg-black/70 backdrop-blur-sm text-white text-xs font-semibold px-2 py-1 rounded-md">
          {scanLabel}
        </span>
        <select
          value={selectedDate ?? ''}
          onChange={(e) => onDateChange(e.target.value)}
          className="bg-black/50 backdrop-blur-sm text-gray-200 text-[10px] font-medium px-2 py-1 rounded-md border-0 cursor-pointer focus:outline-none"
          style={{ colorScheme: 'dark' }}
        >
          {scenes.length > 0
            ? scenes.map((s) => (
                <option
                  key={s.date}
                  value={s.date}
                  disabled={noSpectralDates.has(s.date)}
                  style={{ background: '#111827', color: noSpectralDates.has(s.date) ? '#4b5563' : '#e5e7eb' }}
                >
                  {formatDate(s.date)}{s.cloud_cover < 15 ? ' ✓' : ''}{noSpectralDates.has(s.date) ? ' (no data)' : ''}
                </option>
              ))
            : <option value="" style={{ background: '#111827', color: '#e5e7eb' }}>Latest available</option>
          }
        </select>
        </div>
        {analysisData?.actual_scene_date && selectedDate && analysisData.actual_scene_date !== selectedDate && (
          <span className="bg-yellow-500/80 backdrop-blur-sm text-black text-[9px] font-semibold px-2 py-0.5 rounded-md">
            Using {formatDate(analysisData.actual_scene_date)} (closest clear)
          </span>
        )}
      </div>

      {/* Top-right: avg + source */}
      <div className="absolute top-2.5 right-2.5 z-10 flex flex-col items-end gap-1">
        {layer !== 'RGB' && displayAvg && (
          <div className="bg-black/70 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-md">
            {layer} avg {displayAvg}
          </div>
        )}
      </div>

      {/* Bottom: colour scale */}
      {layer !== 'RGB' && (
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-2.5 pt-6 bg-gradient-to-t from-black/60 to-transparent">
          <div
            className="h-2.5 w-full rounded-full"
            style={{
              background: layer === 'NDVI'
                ? 'linear-gradient(to right, #7f0000, #ef4444, #f97316, #eab308, #a3e635, #22c55e, #15803d)'
                : 'linear-gradient(to right, #9333ea, #ec4899, #f97316, #eab308, #84cc16, #22c55e, #15803d)',
            }}
          />
          <div className="flex justify-between mt-1">
            {['0.0', '0.2', '0.4', '0.6', '0.8', '1.0'].map((v) => (
              <span key={v} className="text-[8px] text-white/75 font-medium leading-none">{v}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── IntelligenceInsights panel ───────────────────────────────────────────────

function IntelligenceInsights({ dataA, dataB, loadingA, loadingB, contextData }: {
  dataA: AnalysisData | null
  dataB: AnalysisData | null
  loadingA: boolean
  loadingB: boolean
  contextData: ContextData | null
}) {
  const [activeTab, setActiveTab] = useState<MetricTab>('NDVI')

  const SectionTitle = ({ label }: { label: string }) => (
    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
  )

  const StatBox = ({ lbl, value, loading, className = '' }: { lbl: string; value: string; loading?: boolean; className?: string }) => (
    <div className="bg-gray-50 rounded-lg py-2 text-center">
      <p className="text-[9px] text-gray-400 mb-0.5">{lbl}</p>
      {loading ? <Spinner /> : <p className={`text-base font-bold ${className || 'text-gray-900'}`}>{value}</p>}
    </div>
  )

  const ChangeRow = ({ children }: { children: ReactNode }) => (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-1.5">
      <span className="text-[10px] text-gray-500">Change (A vs B)</span>
      {children}
    </div>
  )

  const ndviDelta = dataA && dataB ? (dataA.stats.cropHealthScore - dataB.stats.cropHealthScore) / 100 : null
  const ndreDelta = dataA && dataB ? (dataA.stats.ndreScore - dataB.stats.ndreScore) / 100 : null
  const ndmiDelta = dataA && dataB && dataA.stats.ndmiScore != null && dataB.stats.ndmiScore != null ? (dataA.stats.ndmiScore - dataB.stats.ndmiScore) / 100 : null
  const eviDelta  = dataA && dataB && dataA.stats.eviScore  != null && dataB.stats.eviScore  != null ? (dataA.stats.eviScore  - dataB.stats.eviScore)  / 100 : null
  const ndwiDelta = dataA && dataB && dataA.stats.ndwiScore != null && dataB.stats.ndwiScore != null ? (dataA.stats.ndwiScore - dataB.stats.ndwiScore) / 100 : null
  const stressDelta = dataA && dataB ? dataA.stats.affectedAreaPct - dataB.stats.affectedAreaPct : null
  const insights = dataA && dataB ? generateInsights(dataA, dataB) : null

  const METRIC_TABS: MetricTab[] = ['NDVI', 'NDRE', 'NDMI', 'EVI', 'NDWI']

  const renderMetricCard = () => {
    const loading = (!dataA && loadingA) || (!dataB && loadingB)

    if (activeTab === 'NDVI') return (
      <div className="grid grid-cols-2 gap-1 mb-1">
        <StatBox lbl="Scan A" value={dataA ? (dataA.stats.cropHealthScore / 100).toFixed(2) : '—'} loading={!dataA && loadingA} />
        <StatBox lbl="Scan B" value={dataB ? (dataB.stats.cropHealthScore / 100).toFixed(2) : '—'} loading={!dataB && loadingB} />
        {ndviDelta !== null && (
          <div className="col-span-2">
            <ChangeRow>
              <div className="flex items-center gap-1">
                {ndviDelta < -0.02 ? <HiTrendingDown className="w-3 h-3 text-red-500" />
                  : ndviDelta > 0.02 ? <HiTrendingUp className="w-3 h-3 text-green-500" />
                  : <HiMinus className="w-3 h-3 text-gray-400" />}
                <span className={`text-[10px] font-semibold ${ndviDelta < -0.02 ? 'text-red-600' : ndviDelta > 0.02 ? 'text-green-600' : 'text-gray-500'}`}>
                  {ndviDelta > 0 ? '+' : ''}{(ndviDelta * 100).toFixed(1)}%
                </span>
              </div>
            </ChangeRow>
          </div>
        )}
        {loading && !dataA && !dataB && (
          <div className="col-span-2 h-8 bg-gray-100 animate-pulse rounded-lg" />
        )}
      </div>
    )

    if (activeTab === 'NDRE') return (
      <div className="grid grid-cols-2 gap-1 mb-1">
        <StatBox lbl="Scan A" value={dataA ? (dataA.stats.ndreScore / 100).toFixed(2) : '—'} loading={!dataA && loadingA} />
        <StatBox lbl="Scan B" value={dataB ? (dataB.stats.ndreScore / 100).toFixed(2) : '—'} loading={!dataB && loadingB} />
        {ndreDelta !== null && (
          <div className="col-span-2">
            <ChangeRow>
              <div className="flex items-center gap-1">
                {ndreDelta < -0.02 ? <HiTrendingDown className="w-3 h-3 text-red-500" />
                  : ndreDelta > 0.02 ? <HiTrendingUp className="w-3 h-3 text-green-500" />
                  : <HiMinus className="w-3 h-3 text-gray-400" />}
                <span className={`text-[10px] font-semibold ${ndreDelta < -0.02 ? 'text-red-600' : ndreDelta > 0.02 ? 'text-green-600' : 'text-gray-500'}`}>
                  {ndreDelta > 0 ? '+' : ''}{(ndreDelta * 100).toFixed(1)}%
                </span>
              </div>
            </ChangeRow>
          </div>
        )}
      </div>
    )

    if (activeTab === 'NDMI') return (
      <div className="grid grid-cols-2 gap-1 mb-1">
        <StatBox lbl="Scan A" value={dataA ? (dataA.stats.ndmiScore != null ? (dataA.stats.ndmiScore / 100).toFixed(2) : 'N/A') : '—'} loading={!dataA && loadingA} />
        <StatBox lbl="Scan B" value={dataB ? (dataB.stats.ndmiScore != null ? (dataB.stats.ndmiScore / 100).toFixed(2) : 'N/A') : '—'} loading={!dataB && loadingB} />
        {ndmiDelta !== null && (
          <div className="col-span-2">
            <ChangeRow>
              <div className="flex items-center gap-1">
                {ndmiDelta < -0.02 ? <HiTrendingDown className="w-3 h-3 text-red-500" />
                  : ndmiDelta > 0.02 ? <HiTrendingUp className="w-3 h-3 text-green-500" />
                  : <HiMinus className="w-3 h-3 text-gray-400" />}
                <span className={`text-[10px] font-semibold ${ndmiDelta < -0.02 ? 'text-red-600' : ndmiDelta > 0.02 ? 'text-green-600' : 'text-gray-500'}`}>
                  {ndmiDelta > 0 ? '+' : ''}{(ndmiDelta * 100).toFixed(1)}%
                </span>
              </div>
            </ChangeRow>
          </div>
        )}
      </div>
    )

    if (activeTab === 'EVI') return (
      <div className="grid grid-cols-2 gap-1 mb-1">
        <StatBox lbl="Scan A" value={dataA ? (dataA.stats.eviScore != null ? (dataA.stats.eviScore / 100).toFixed(2) : 'N/A') : '—'} loading={!dataA && loadingA} />
        <StatBox lbl="Scan B" value={dataB ? (dataB.stats.eviScore != null ? (dataB.stats.eviScore / 100).toFixed(2) : 'N/A') : '—'} loading={!dataB && loadingB} />
        {eviDelta !== null && (
          <div className="col-span-2">
            <ChangeRow>
              <div className="flex items-center gap-1">
                {eviDelta < -0.02 ? <HiTrendingDown className="w-3 h-3 text-red-500" />
                  : eviDelta > 0.02 ? <HiTrendingUp className="w-3 h-3 text-green-500" />
                  : <HiMinus className="w-3 h-3 text-gray-400" />}
                <span className={`text-[10px] font-semibold ${eviDelta < -0.02 ? 'text-red-600' : eviDelta > 0.02 ? 'text-green-600' : 'text-gray-500'}`}>
                  {eviDelta > 0 ? '+' : ''}{(eviDelta * 100).toFixed(1)}%
                </span>
              </div>
            </ChangeRow>
          </div>
        )}
      </div>
    )

    // NDWI
    return (
      <div className="grid grid-cols-2 gap-1 mb-1">
        <StatBox lbl="Scan A" value={dataA ? (dataA.stats.ndwiScore != null ? (dataA.stats.ndwiScore / 100).toFixed(2) : 'N/A') : '—'} loading={!dataA && loadingA} />
        <StatBox lbl="Scan B" value={dataB ? (dataB.stats.ndwiScore != null ? (dataB.stats.ndwiScore / 100).toFixed(2) : 'N/A') : '—'} loading={!dataB && loadingB} />
        {ndwiDelta !== null && (
          <div className="col-span-2">
            <ChangeRow>
              <div className="flex items-center gap-1">
                {ndwiDelta < -0.02 ? <HiTrendingDown className="w-3 h-3 text-red-500" />
                  : ndwiDelta > 0.02 ? <HiTrendingUp className="w-3 h-3 text-green-500" />
                  : <HiMinus className="w-3 h-3 text-gray-400" />}
                <span className={`text-[10px] font-semibold ${ndwiDelta < -0.02 ? 'text-red-600' : ndwiDelta > 0.02 ? 'text-green-600' : 'text-gray-500'}`}>
                  {ndwiDelta > 0 ? '+' : ''}{(ndwiDelta * 100).toFixed(1)}%
                </span>
              </div>
            </ChangeRow>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 h-full">

      {/* ── Crop context snippet ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <SectionTitle label="Crop Context" />
          <Link to="/context" className="text-[9px] text-green-700 font-medium hover:underline">Full →</Link>
        </div>
        {contextData ? (
          <>
            {contextData.stage ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-800">{contextData.stage.label}</span>
                  {contextData.stage.zadoks && <span className="text-[9px] text-gray-400">{contextData.stage.zadoks}</span>}
                </div>
                <div className="flex justify-between text-[9px] text-gray-400">
                  <span>{contextData.stage.crop_name}</span>
                  <span>GDD {Math.round(contextData.stage.gdd_accumulated)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.round(contextData.stage.overall_pct * 100)}%` }} />
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-amber-600 mb-1">No crop set — add in Context tab</p>
            )}
            {contextData.weather && (
              <div className="flex gap-3 mt-1.5">
                <span className="text-[9px] text-gray-500">Rain 7d: <span className="font-medium text-gray-700">{contextData.weather.rain_7d.toFixed(1)}mm</span></span>
                <span className="text-[9px] text-gray-500">Avg: <span className="font-medium text-gray-700">{contextData.weather.temp_avg_7d.toFixed(1)}°C</span></span>
              </div>
            )}
            {contextData.signals.slice(0, 2).map((sig, i) => (
              <div key={i} className={`flex gap-1 rounded px-1.5 py-1 mt-1 ${
                sig.type === 'warning' ? 'bg-red-50' : sig.type === 'positive' ? 'bg-green-50' : 'bg-blue-50'
              }`}>
                <span className={`text-[9px] font-medium leading-tight ${
                  sig.type === 'warning' ? 'text-red-700' : sig.type === 'positive' ? 'text-green-700' : 'text-blue-700'
                }`}>{sig.title}</span>
              </div>
            ))}
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="h-2 bg-gray-100 animate-pulse rounded w-3/4" />
            <div className="h-2 bg-gray-100 animate-pulse rounded w-1/2" />
            <div className="h-1.5 bg-gray-100 animate-pulse rounded w-full" />
          </div>
        )}
      </div>

      {/* ── Stress Coverage ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 flex-shrink-0">
        <SectionTitle label="Stress Coverage" />
        <div className="grid grid-cols-2 gap-1 mb-1">
          <StatBox
            lbl="Scan A"
            value={dataA ? `${dataA.stats.affectedAreaPct}%` : '—'}
            loading={!dataA && loadingA}
            className={dataA ? (dataA.stats.affectedAreaPct > 20 ? 'text-red-600' : dataA.stats.affectedAreaPct > 10 ? 'text-yellow-600' : 'text-green-600') : ''}
          />
          <StatBox
            lbl="Scan B"
            value={dataB ? `${dataB.stats.affectedAreaPct}%` : '—'}
            loading={!dataB && loadingB}
            className={dataB ? (dataB.stats.affectedAreaPct > 20 ? 'text-red-600' : dataB.stats.affectedAreaPct > 10 ? 'text-yellow-600' : 'text-green-600') : ''}
          />
        </div>
        {stressDelta !== null ? (
          <ChangeRow>
            <span className={`text-[10px] font-semibold ${stressDelta > 3 ? 'text-red-600' : stressDelta < -3 ? 'text-green-600' : 'text-gray-500'}`}>
              {stressDelta > 0 ? '+' : ''}{stressDelta.toFixed(1)} pp
            </span>
          </ChangeRow>
        ) : (loadingA || loadingB) ? (
          <div className="h-7 bg-gray-100 animate-pulse rounded-lg" />
        ) : null}
      </div>

      {/* ── Key Insights ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 flex-shrink-0">
        <SectionTitle label="Key Insights" />
        {insights ? (
          <div className="space-y-1">
            {insights.map((ins, i) => (
              <div key={i} className="flex gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full mt-[3px] flex-shrink-0 ${
                  ins.type === 'warning' ? 'bg-red-500' : ins.type === 'positive' ? 'bg-green-500' : 'bg-yellow-400'
                }`} />
                <p className="text-[10px] text-gray-600 leading-snug">{ins.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="h-2.5 bg-gray-100 animate-pulse rounded w-full" />
            <div className="h-2.5 bg-gray-100 animate-pulse rounded w-5/6" />
            <div className="h-2.5 bg-gray-100 animate-pulse rounded w-4/6" />
          </div>
        )}
      </div>

      {/* ── Comparison metrics (tabbed) ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 flex-shrink-0">
        {/* Tab bar */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-2">
          {METRIC_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'flex-1 py-1 text-[9px] font-semibold transition-colors',
                activeTab === tab ? 'bg-green-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>
        <SectionTitle label={`${activeTab} Comparison`} />
        {renderMetricCard()}
      </div>

    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function IntelligencePage() {
  const { farm } = useFarm()
  const fields = farm?.fields.features ?? []

  const [selectedIdx, setSelectedIdx] = useState(0)
  const [layer, setLayer] = useState<VegLayer>('NDVI')

  const [scenes, setScenes] = useState<Scene[]>([])
  const [isFetchingScenes, setIsFetchingScenes] = useState(false)
  const [scanA, setScanA] = useState<string | null>(null)
  const [scanB, setScanB] = useState<string | null>(null)
  const [analysisA, setAnalysisA] = useState<AnalysisData | null>(null)
  const [analysisB, setAnalysisB] = useState<AnalysisData | null>(null)
  const [isAnalysingA, setIsAnalysingA] = useState(false)
  const [isAnalysingB, setIsAnalysingB] = useState(false)
  const [noSpectralDates, setNoSpectralDates] = useState<Set<string>>(new Set())
  const [contextData, setContextData] = useState<ContextData | null>(null)

  const mapARef = useRef<L.Map | null>(null)
  const mapBRef = useRef<L.Map | null>(null)
  const syncingRef = useRef(false)

  const selectedField = fields[selectedIdx] ?? null

  // Reset when farm changes
  useEffect(() => {
    setSelectedIdx(0)
    setScenes([])
    setIsFetchingScenes(false)
    setScanA(null)
    setScanB(null)
    setAnalysisA(null)
    setAnalysisB(null)
    setNoSpectralDates(new Set())
    setContextData(null)
  }, [farm?.meta.farm_id])

  // Fetch context for selected field
  useEffect(() => {
    if (!selectedField) { setContextData(null); return }

    // Use cached context if it was fetched alongside the same analysisA scan date
    const cached = getCachedEntry(selectedField.id)
    if (cached?.contextData && analysisA && cached.analysisA === analysisA) {
      setContextData(cached.contextData)
      return
    }

    const params = new URLSearchParams()
    if (analysisA) {
      params.set('ndvi', (analysisA.stats.cropHealthScore / 100).toFixed(3))
      if (analysisA.stats.ndmiScore != null) params.set('ndmi', (analysisA.stats.ndmiScore / 100).toFixed(3))
      if (analysisA.stats.ndwiScore != null) params.set('ndwi', (analysisA.stats.ndwiScore / 100).toFixed(3))
    }
    const qs = params.toString()
    fetch(`/api/context/analyse${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedField),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setContextData)
      .catch(() => {})
  }, [selectedField?.id, analysisA])

  // Fetch available scenes when field changes
  useEffect(() => {
    if (!selectedField) { setScenes([]); setScanA(null); setScanB(null); return }
    setScenes([])
    setScanA(null)
    setScanB(null)
    setAnalysisA(null)
    setAnalysisB(null)
    setNoSpectralDates(new Set())

    // Use pre-cached scenes if available
    const cached = getCachedEntry(selectedField.id)
    if (cached?.scenes.length) {
      setScenes(cached.scenes)
      setIsAnalysingA(cached.analysisA == null)
      setScanA(cached.scanDateA ?? '')
      if (cached.scenes.length > 1) {
        setIsAnalysingB(cached.analysisB == null)
        setScanB(cached.scanDateB ?? null)
      }
      return
    }

    setIsFetchingScenes(true)
    fetch('/api/intelligence/scenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedField),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Scene[]) => {
        setScenes(data)
        if (data.length > 0) {
          // Pre-set analysing flags before scan dates so overlay stays up with no flash
          setIsAnalysingA(true)
          setScanA(data[0].date)
          if (data.length > 1) {
            setIsAnalysingB(true)
            setScanB(data[1].date)
          }
        } else {
          setScanA('')
        }
      })
      .catch(() => { setScanA('') })
      .finally(() => setIsFetchingScenes(false))
  }, [selectedField?.id])

  // Fetch analysis for Scan A
  useEffect(() => {
    if (!selectedField || scanA === null) { setAnalysisA(null); return }
    const dateA = scanA

    // Check memo for this specific date (covers pre-cache and previously viewed dates)
    const memoized = dateA ? getMemoizedAnalysis(selectedField.id, dateA) : null
    if (memoized) {
      setAnalysisA(memoized)
      setIsAnalysingA(false)
      if (!memoized.ndvi_overlay && dateA) {
        setNoSpectralDates((prev) => new Set([...prev, dateA]))
      }
      return
    }

    setIsAnalysingA(true)
    setAnalysisA(null)
    const url = dateA ? `/api/intelligence/analyse?scene_date=${dateA}` : '/api/intelligence/analyse'
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedField),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: AnalysisData) => {
        if (dateA) memoizeAnalysis(selectedField.id, dateA, data)
        setAnalysisA(data)
        if (!data.ndvi_overlay && dateA) {
          setNoSpectralDates((prev) => new Set([...prev, dateA]))
        }
      })
      .catch(console.error)
      .finally(() => setIsAnalysingA(false))
  }, [selectedField?.id, scanA])

  // Fetch analysis for Scan B
  useEffect(() => {
    if (!selectedField || scanB === null) { setAnalysisB(null); return }
    const dateB = scanB

    // Check memo for this specific date
    const memoized = dateB ? getMemoizedAnalysis(selectedField.id, dateB) : null
    if (memoized) {
      setAnalysisB(memoized)
      setIsAnalysingB(false)
      if (!memoized.ndvi_overlay && dateB) {
        setNoSpectralDates((prev) => new Set([...prev, dateB]))
      }
      return
    }

    setIsAnalysingB(true)
    setAnalysisB(null)
    const url = dateB ? `/api/intelligence/analyse?scene_date=${dateB}` : '/api/intelligence/analyse'
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedField),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: AnalysisData) => {
        if (dateB) memoizeAnalysis(selectedField.id, dateB, data)
        setAnalysisB(data)
        if (!data.ndvi_overlay && dateB) {
          setNoSpectralDates((prev) => new Set([...prev, dateB]))
        }
      })
      .catch(console.error)
      .finally(() => setIsAnalysingB(false))
  }, [selectedField?.id, scanB])



  // Initial load: both cards show spinner until scenes have arrived and a date is selected.
  // After that, each card tracks its own loading state independently.
  const initialLoading = selectedField !== null && (isFetchingScenes || scanA === null)
  const analysingA = initialLoading || isAnalysingA
  const analysingB = initialLoading || isAnalysingB

  const statusLabel = analysisA
    ? (analysisA.stats.cropHealthScore >= 65 ? 'Good'
       : analysisA.stats.cropHealthScore >= 50 ? 'Watch'
       : 'Needs Attention')
    : analysingA ? 'Loading…'
    : '—'
  const statusColor =
    statusLabel === 'Good' ? 'text-green-600' :
    statusLabel === 'Watch' ? 'text-yellow-600' :
    statusLabel === 'Needs Attention' ? 'text-red-600' :
    'text-gray-400'

  return (
    <div className="h-full flex flex-col overflow-hidden px-5 pt-4 pb-4 gap-3">
      <p className="text-sm font-semibold text-gray-400 tracking-wide flex-shrink-0">Intelligence</p>

      {/* ── Controls bar ── */}
      <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Field</span>
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="text-sm text-gray-700 border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {fields.length > 0
              ? fields.map((f, i) => (
                  <option key={f.id} value={i}>{f.properties.name}</option>
                ))
              : Array.from({ length: 6 }, (_, i) => (
                  <option key={i} value={i}>{i + 1}</option>
                ))
            }
          </select>
          <span className={`text-xs font-semibold whitespace-nowrap ${statusColor}`}>
            {statusLabel}
          </span>
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {selectedField
              ? `${selectedField.properties.area_hectares.toFixed(1)} ha${selectedField.properties.crop_type ? ` · ${selectedField.properties.crop_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}` : ''}`
              : '—'}
          </span>
        </div>

        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          {(['RGB', 'VARI', 'NDVI', 'NDRE', 'NDMI', 'EVI', 'NDWI'] as VegLayer[]).map((v) => (
            <button
              key={v}
              onClick={() => setLayer(v)}
              className={[
                'px-2.5 py-1.5 text-xs font-medium transition-colors',
                layer === v ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
              ].join(' ')}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-h-0 flex gap-3">
          <div className="flex-1 min-w-0 grid grid-cols-2 gap-3">
            <FieldHeatmapView
              fieldIdx={selectedIdx}
              fieldFeature={selectedField}
              scenes={scenes}
              selectedDate={scanA}
              onDateChange={setScanA}
              layer={layer}
              scanLabel="Scan A"
              analysisData={analysisA}
              isAnalysing={analysingA}
              noSpectralDates={noSpectralDates}
              mapRef={mapARef}
              otherMapRef={mapBRef}
              syncingRef={syncingRef}
            />
            <FieldHeatmapView
              fieldIdx={selectedIdx}
              fieldFeature={selectedField}
              scenes={scenes}
              selectedDate={scanB}
              onDateChange={setScanB}
              layer={layer}
              scanLabel="Scan B"
              analysisData={analysisB}
              isAnalysing={analysingB}
              noSpectralDates={noSpectralDates}
              mapRef={mapBRef}
              otherMapRef={mapARef}
              syncingRef={syncingRef}
            />
          </div>

          {/* Right panel — always shown with ghost elements, no scroll */}
          {selectedField && (
            <div className="w-64 flex-shrink-0 overflow-hidden">
              <IntelligenceInsights
                dataA={analysisA}
                dataB={analysisB}
                loadingA={isAnalysingA}
                loadingB={isAnalysingB}
                contextData={contextData}
              />
            </div>
          )}
        </div>
    </div>
  )
}
