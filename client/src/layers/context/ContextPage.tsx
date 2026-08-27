import { useState, useEffect } from 'react'
import { useFarm } from '../../contexts/FarmContext'
import type { ContextData } from './types'
import type { AnalysisData } from '../intelligence/types'
import { CROP_OPTIONS } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—'
  return n.toFixed(decimals)
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-2.5 bg-gray-100 rounded w-full mb-2" />
      ))}
    </div>
  )
}

// ─── Weather bar chart (mini) ──────────────────────────────────────────────────

function PrecipBar({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-blue-400"
          style={{ height: `${Math.max(4, (v / max) * 32)}px` }}
          title={`${v.toFixed(1)}mm`}
        />
      ))}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, color = 'bg-green-500' }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  )
}

// ─── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
}

// ─── Signal badge ──────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: ContextData['signals'][0] }) {
  const colour =
    signal.type === 'warning' ? 'border-l-red-400 bg-red-50'
    : signal.type === 'positive' ? 'border-l-green-400 bg-green-50'
    : 'border-l-blue-300 bg-blue-50'
  return (
    <div className={`border-l-4 ${colour} rounded-r-lg px-3 py-2`}>
      <p className="text-xs font-semibold text-gray-800">{signal.title}</p>
      <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{signal.body}</p>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function ContextPage() {
  const { farm, refresh } = useFarm()
  const fields = farm?.fields.features ?? []

  const [selectedIdx, setSelectedIdx] = useState(0)
  const [context, setContext] = useState<ContextData | null>(null)
  const [satellite, setSatellite] = useState<AnalysisData | null>(null)
  const [loadingCtx, setLoadingCtx] = useState(false)
  const [loadingSat, setLoadingSat] = useState(false)

  // Inline crop edit state
  const [editCropType, setEditCropType] = useState('')
  const [editSowingDate, setEditSowingDate] = useState('')
  const [saving, setSaving] = useState(false)

  const field = fields[selectedIdx] ?? null

  // Sync edit state when field changes
  useEffect(() => {
    setEditCropType(field?.properties.crop_type ?? '')
    setEditSowingDate(field?.properties.sowing_date ?? '')
    setContext(null)
    setSatellite(null)
  }, [field?.id])

  // Fetch context + satellite in parallel when field changes
  useEffect(() => {
    if (!field) return

    // Context analysis
    setLoadingCtx(true)
    fetch('/api/context/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(field),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setContext)
      .catch(console.error)
      .finally(() => setLoadingCtx(false))

    // Satellite analysis (for NDVI/NDMI values to enrich context signals)
    setLoadingSat(true)
    fetch('/api/intelligence/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(field),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setSatellite)
      .catch(console.error)
      .finally(() => setLoadingSat(false))
  }, [field?.id, field?.properties.crop_type, field?.properties.sowing_date])

  // Re-fetch context with satellite scores once both are available
  useEffect(() => {
    if (!field || !satellite) return
    const ndvi = satellite.stats.cropHealthScore / 100
    const ndmi = satellite.stats.ndmiScore != null ? satellite.stats.ndmiScore / 100 : undefined
    const ndwi = satellite.stats.ndwiScore != null ? satellite.stats.ndwiScore / 100 : undefined
    const params = new URLSearchParams()
    params.set('ndvi', ndvi.toFixed(3))
    if (ndmi != null) params.set('ndmi', ndmi.toFixed(3))
    if (ndwi != null) params.set('ndwi', ndwi.toFixed(3))

    fetch(`/api/context/analyse?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(field),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setContext)
      .catch(console.error)
  }, [satellite?.stats.cropHealthScore, field?.id])

  async function saveCropDetails() {
    if (!farm || !field) return
    setSaving(true)
    try {
      const res = await fetch(`/api/farms/${farm.meta.farm_id}/crop-details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{ field_id: field.id, crop_type: editCropType || null, sowing_date: editSowingDate || null }],
        }),
      })
      if (res.ok) refresh()
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  const cropDirty =
    editCropType !== (field?.properties.crop_type ?? '') ||
    editSowingDate !== (field?.properties.sowing_date ?? '')

  return (
    <div className="h-full flex flex-col overflow-hidden px-5 pt-4 pb-4 gap-3">
      <p className="text-sm font-semibold text-gray-400 tracking-wide flex-shrink-0">Context</p>

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
              : <option value={0}>No fields</option>
            }
          </select>
        </div>

        {/* Inline crop edit */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Crop</span>
          <select
            value={editCropType}
            onChange={(e) => setEditCropType(e.target.value)}
            className="text-sm text-gray-700 border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {CROP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={editSowingDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setEditSowingDate(e.target.value)}
            className="text-sm text-gray-700 border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {cropDirty && (
            <button
              onClick={saveCropDetails}
              disabled={saving}
              className="text-xs font-semibold bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* ── No crop prompt ── */}
      {!field?.properties.crop_type && !loadingCtx && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          Set a crop type and sowing date above to unlock growth stage tracking and contextual recommendations.
          Weather and soil data will still load.
        </div>
      )}

      {/* ── Card grid ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3">
        <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">

          {/* Growth Stage card */}
          {loadingCtx ? <SkeletonCard rows={4} /> : context?.stage ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle label="Growth Stage" />
              <p className="text-sm font-bold text-gray-900">{context.stage.label}</p>
              {context.stage.zadoks && (
                <p className="text-[10px] text-gray-400 mb-2">{context.stage.zadoks}</p>
              )}
              <div className="space-y-2 mt-2">
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                    <span>Stage progress</span>
                    <span>{Math.round(context.stage.stage_pct * 100)}%</span>
                  </div>
                  <ProgressBar pct={context.stage.stage_pct} color="bg-green-500" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                    <span>GDD {context.stage.gdd_accumulated} / {context.stage.gdd_total_target}</span>
                    <span>{Math.round(context.stage.overall_pct * 100)}% season</span>
                  </div>
                  <ProgressBar pct={context.stage.overall_pct} color="bg-blue-400" />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                Day {context.stage.days_since_sowing} in ground · {context.stage.crop_name}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-center">
              <p className="text-[10px] text-gray-400 text-center">
                {field?.properties.crop_type
                  ? 'Loading stage data…'
                  : 'Set crop & sowing date to see growth stage'}
              </p>
            </div>
          )}

          {/* Weather card */}
          {loadingCtx ? <SkeletonCard rows={4} /> : context?.weather ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle label="Weather · Last 7 Days" />
              <div className="mb-2">
                <PrecipBar values={context.weather.daily_precipitation} />
                <p className="text-[9px] text-gray-400 mt-1">Daily rainfall (mm)</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="text-center">
                  <p className="text-base font-bold text-blue-600">{fmt(context.weather.rain_7d)}</p>
                  <p className="text-[9px] text-gray-400">mm total</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-gray-800">{fmt(context.weather.temp_avg_7d)}°</p>
                  <p className="text-[9px] text-gray-400">avg temp</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-sky-500">{fmt(context.weather.forecast_rain_3d)}</p>
                  <p className="text-[9px] text-gray-400">3d forecast</p>
                </div>
              </div>
              {context.weather.gdd_accumulated != null && (
                <p className="text-[10px] text-gray-400 mt-2 border-t border-gray-100 pt-2">
                  GDD accumulated: <span className="font-semibold text-gray-700">{fmt(context.weather.gdd_accumulated, 0)}</span> since sowing
                </p>
              )}
            </div>
          ) : <SkeletonCard rows={4} />}

          {/* Soil card */}
          {loadingCtx ? <SkeletonCard rows={4} /> : context?.soil ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle label="Soil Profile (0–5 cm)" />
              <div className="space-y-1.5">
                {[
                  { label: 'Clay', value: context.soil.clay_pct, unit: '%' },
                  { label: 'Silt', value: context.soil.silt_pct, unit: '%' },
                  { label: 'Sand', value: context.soil.sand_pct, unit: '%' },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, value ?? 0)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-gray-700 w-10 text-right">{fmt(value)}{unit}</span>
                    </div>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-1.5 mt-1 grid grid-cols-2 gap-1">
                  <div>
                    <p className="text-[9px] text-gray-400">pH</p>
                    <p className="text-sm font-bold text-gray-800">{fmt(context.soil.ph)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400">Organic C</p>
                    <p className="text-sm font-bold text-gray-800">{fmt(context.soil.soc_pct)}%</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle label="Soil Profile" />
              <p className="text-[10px] text-gray-400">{loadingCtx ? 'Loading…' : 'Soil data unavailable'}</p>
            </div>
          )}

          {/* Satellite Summary card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <SectionTitle label="Satellite Summary" />
            {loadingSat ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-2.5 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : satellite ? (
              <div className="space-y-2">
                {[
                  { label: 'NDVI', score: satellite.stats.cropHealthScore, stage: context?.stage },
                  { label: 'NDRE', score: satellite.stats.ndreScore, stage: null },
                  { label: 'NDMI', score: satellite.stats.ndmiScore, stage: null },
                  { label: 'EVI',  score: satellite.stats.eviScore, stage: null },
                  { label: 'NDWI', score: satellite.stats.ndwiScore, stage: null },
                ].map(({ label, score, stage: st }) => {
                  if (score == null) return null
                  const val = score / 100
                  const delta = st ? val - (st.ndvi_expected_lo + st.ndvi_expected_hi) / 2 : null
                  const colour = label === 'NDVI' && delta != null
                    ? delta < -0.08 ? 'text-red-600' : delta > 0.05 ? 'text-green-600' : 'text-gray-700'
                    : 'text-gray-700'
                  return (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-gray-500 w-10">{label}</span>
                      <div className="flex-1 mx-2 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${score}%` }} />
                      </div>
                      <span className={`text-[10px] font-bold ${colour} w-10 text-right`}>
                        {val.toFixed(2)}
                        {label === 'NDVI' && delta != null && (
                          <span className="text-[9px] ml-0.5">{delta >= 0 ? '↑' : '↓'}</span>
                        )}
                      </span>
                    </div>
                  )
                })}
                <p className="text-[9px] text-gray-400 pt-1 border-t border-gray-100">
                  {satellite.vegetation_layer === 'Sentinel-2' ? 'Sentinel-2 · real bands' : 'RGB estimate'}
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-gray-400">No satellite data loaded</p>
            )}
          </div>

        </div>

        {/* ── Contextual Signals ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mt-0">
          <SectionTitle label="Contextual Signals" />
          {loadingCtx ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : context?.signals?.length ? (
            <div className="space-y-2">
              {context.signals.map((s, i) => <SignalCard key={i} signal={s} />)}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400">No signals — set crop details and run analysis.</p>
          )}
        </div>
      </div>
    </div>
  )
}
