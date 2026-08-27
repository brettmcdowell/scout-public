import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useFarm } from '../contexts/FarmContext'
import { Badge } from 'flowbite-react'
import {
  HiLocationMarker, HiChartBar, HiExclamation, HiRefresh,
  HiChevronDown, HiChevronUp, HiArrowLeft,
} from 'react-icons/hi'
import { MapContainer, TileLayer, Polygon, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { FieldFeature } from '../types/geo'
import type { ContextData } from '../layers/context/types'
import { ESRI_SATELLITE_URL, ESRI_ATTRIBUTION } from '../components/map/constants'

export const Route = createFileRoute('/overview')({ component: OverviewPage })

// ─── Field helpers ──────────────────────────────────────────────────────────

function centroid(f: FieldFeature): [number, number] {
  const coords = f.geometry.coordinates[0]
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
  return [lat, lng]
}

const STATUS_CYCLE = ['Good', 'Good', 'Watch', 'Good', 'Needs Attention', 'Good', 'Watch', 'Good'] as const
type FieldStatus = typeof STATUS_CYCLE[number]

function fieldStatus(idx: number): FieldStatus {
  return STATUS_CYCLE[idx % STATUS_CYCLE.length]
}

function statusColor(status: FieldStatus): string {
  if (status === 'Good') return '#16a34a'
  if (status === 'Watch') return '#d97706'
  return '#dc2626'
}

const NDVI_DATA = [
  { ndviAvg: 0.72, ndviMin: 0.51, ndviMax: 0.88, nitrate: 34, ph: 6.8, moisture: 42 },
  { ndviAvg: 0.68, ndviMin: 0.49, ndviMax: 0.81, nitrate: 29, ph: 6.5, moisture: 38 },
  { ndviAvg: 0.41, ndviMin: 0.18, ndviMax: 0.63, nitrate: 17, ph: 5.9, moisture: 24 },
  { ndviAvg: 0.58, ndviMin: 0.38, ndviMax: 0.74, nitrate: 26, ph: 6.2, moisture: 35 },
  { ndviAvg: 0.74, ndviMin: 0.55, ndviMax: 0.90, nitrate: 37, ph: 6.9, moisture: 44 },
  { ndviAvg: 0.70, ndviMin: 0.52, ndviMax: 0.85, nitrate: 31, ph: 6.7, moisture: 40 },
]

function fieldStats(idx: number) {
  return NDVI_DATA[idx % NDVI_DATA.length]
}

// ─── Overview map ────────────────────────────────────────────────────────────

interface SelectedField { feature: FieldFeature; idx: number }

function OverviewMapContent({
  fields, selected, onSelect,
}: {
  fields: FieldFeature[]
  selected: SelectedField | null
  onSelect: (f: FieldFeature, idx: number) => void
}) {
  const map = useMap()

  // Fit to all fields when field list is first available
  useEffect(() => {
    if (fields.length === 0) return
    const pts = fields.flatMap(f =>
      f.geometry.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng))
    )
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] })
  }, [map, fields])

  // Fly to selected field, or fly back to overview on deselect
  useEffect(() => {
    if (fields.length === 0) return
    if (!selected) {
      const pts = fields.flatMap(f =>
        f.geometry.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng))
      )
      map.flyToBounds(L.latLngBounds(pts), { padding: [40, 40], duration: 0.8 })
      return
    }
    const pts = selected.feature.geometry.coordinates[0].map(([lng, lat]) => L.latLng(lat, lng))
    map.flyToBounds(L.latLngBounds(pts), { padding: [60, 60], duration: 0.8 })
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <TileLayer url={ESRI_SATELLITE_URL} attribution={ESRI_ATTRIBUTION} />
      {fields.map((f, idx) => {
        const status = fieldStatus(idx)
        const color = statusColor(status)
        const isSelected = selected?.feature.id === f.id
        return (
          <Polygon
            key={f.id}
            positions={f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: isSelected ? '#ffffff' : color,
              fillColor: color,
              fillOpacity: isSelected ? 0.55 : 0.3,
              weight: isSelected ? 2.5 : 1.5,
            }}
            eventHandlers={{
              click: (e) => { L.DomEvent.stopPropagation(e); onSelect(f, idx) },
            }}
          />
        )
      })}
      {fields.map((f, idx) => {
        const status = fieldStatus(idx)
        const color = statusColor(status)
        const [lat, lng] = centroid(f)
        const icon = L.divIcon({
          className: '',
          html: `<div style="display:inline-block;transform:translate(-50%,-50%);background:rgba(255,255,255,0.92);backdrop-filter:blur(4px);border-radius:8px;padding:4px 8px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.6);white-space:nowrap;"><p style="font-size:11px;font-weight:600;color:#1f2937;margin:0;">${f.properties.name}</p><p style="font-size:10px;font-weight:500;color:${color};margin:0;">${status}</p></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        })
        return (
          <Marker
            key={`label-${f.id}`}
            position={[lat, lng]}
            icon={icon}
            eventHandlers={{
              click: (e) => { L.DomEvent.stopPropagation(e); onSelect(f, idx) },
            }}
          />
        )
      })}
    </>
  )
}

// ─── Farm Overview tab ───────────────────────────────────────────────────────

function FarmOverviewTab() {
  const { farm } = useFarm()
  const fields = farm?.fields.features ?? []
  const [selected, setSelected] = useState<SelectedField | null>(null)
  const [animIn, setAnimIn] = useState(false)
  const [contextData, setContextData] = useState<ContextData | null>(null)
  const [isFetchingContext, setIsFetchingContext] = useState(false)

  const ndvi = selected ? fieldStats(selected.idx) : null
  const status = selected ? fieldStatus(selected.idx) : null

  useEffect(() => {
    if (!selected) { setContextData(null); return }
    setContextData(null)
    setIsFetchingContext(true)
    fetch('/api/context/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selected.feature),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setContextData)
      .catch(() => {})
      .finally(() => setIsFetchingContext(false))
  }, [selected?.feature.id])

  function handleSelect(f: FieldFeature, idx: number) {
    setSelected({ feature: f, idx })
    setTimeout(() => setAnimIn(true), 20)
  }

  function handleBack() {
    setAnimIn(false)
    setTimeout(() => setSelected(null), 400)
  }

  if (fields.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No fields found. Complete onboarding to see your farm.
      </div>
    )
  }

  return (
    <div className="flex h-full gap-3 p-3">
      {/* ── Map ── */}
      <div className="flex-1 relative rounded-xl overflow-hidden min-w-0">
        <MapContainer
          style={{ width: '100%', height: '100%' }}
          center={[51.5, -0.1]}
          zoom={13}
          zoomControl={false}
          attributionControl={false}
        >
          <OverviewMapContent fields={fields} selected={selected} onSelect={handleSelect} />
        </MapContainer>

        {selected && (
          <button
            onClick={handleBack}
            className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm font-medium text-gray-700 shadow-sm border border-white/60 hover:border-gray-300 transition-colors"
          >
            <HiArrowLeft className="w-4 h-4" />
            Overview
          </button>
        )}
      </div>

      {/* ── Stats panel — slides in when a field is selected ── */}
      {selected && ndvi && status && (
        <div
          className="w-52 flex-shrink-0 flex flex-col gap-2 overflow-y-auto"
          style={{
            opacity: animIn ? 1 : 0,
            transform: animIn ? 'translateX(0)' : 'translateX(16px)',
            transition: 'opacity 0.3s ease 0.15s, transform 0.3s ease 0.15s',
          }}
        >
          <div className="p-3 bg-white rounded-xl border border-gray-200">
            <p className="text-sm font-semibold text-gray-900">{selected.feature.properties.name}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: statusColor(status) }}>{status}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              {selected.feature.properties.area_hectares.toFixed(1)} ha
              {selected.feature.properties.crop_type
                ? ` · ${selected.feature.properties.crop_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`
                : ''}
            </p>
          </div>

          {/* Context snippet */}
          <div className="p-3 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Context</p>
              <Link to="/context" className="text-[10px] text-green-700 font-medium hover:underline">Full →</Link>
            </div>
            {isFetchingContext && (
              <div className="flex flex-col gap-1.5">
                <div className="h-2 bg-gray-100 animate-pulse rounded w-3/4" />
                <div className="h-2 bg-gray-100 animate-pulse rounded w-1/2" />
                <div className="h-1.5 bg-gray-100 animate-pulse rounded w-full" />
              </div>
            )}
            {contextData && (
              <div className="space-y-1.5">
                {contextData.stage ? (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-800">{contextData.stage.label}</p>
                      {contextData.stage.zadoks && <p className="text-[9px] text-gray-400">{contextData.stage.zadoks}</p>}
                    </div>
                    <p className="text-[9px] text-gray-400">
                      {contextData.stage.crop_name} · GDD {Math.round(contextData.stage.gdd_accumulated)}
                    </p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.round(contextData.stage.overall_pct * 100)}%` }} />
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-amber-600">No crop set — add in Context tab</p>
                )}
                {contextData.weather && (
                  <div className="flex justify-between pt-0.5">
                    <span className="text-[9px] text-gray-400">Rain 7d</span>
                    <span className="text-[9px] font-medium text-gray-700">{contextData.weather.rain_7d.toFixed(1)} mm</span>
                  </div>
                )}
                {contextData.signals.filter((s) => s.type === 'warning').slice(0, 1).map((sig, i) => (
                  <div key={i} className="flex gap-1 bg-red-50 rounded px-2 py-1">
                    <span className="text-[9px]">{sig.icon}</span>
                    <span className="text-[9px] text-red-700 font-medium leading-tight">{sig.title}</span>
                  </div>
                ))}
              </div>
            )}
            {!isFetchingContext && !contextData && (
              <p className="text-[10px] text-gray-400">—</p>
            )}
          </div>

          <div className="p-3 bg-white rounded-xl border border-gray-200">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">NDVI</p>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {([['Avg', ndvi.ndviAvg], ['Min', ndvi.ndviMin], ['Max', ndvi.ndviMax]] as [string, number][]).map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-1.5">
                  <p className="text-[9px] text-gray-400">{k}</p>
                  <p className="text-xs font-semibold text-gray-800">{v.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-gray-200">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Soil</p>
            {[
              { label: 'Nitrate', value: `${ndvi.nitrate} ppm` },
              { label: 'pH',      value: String(ndvi.ph) },
              { label: 'Moisture', value: `${ndvi.moisture}%` },
            ].map((r) => (
              <div key={r.label} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400">{r.label}</span>
                <span className="text-xs font-medium text-gray-700">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Recent Scans tab ────────────────────────────────────────────────────────

const SCANS = [
  { date: 'May 14, 2026', badge: 'Current',  color: 'success' as const, snapshot: { health: '74 / 100', attention: 3, status: 'Worsened',  area: '144.8 ha', crop: 'Winter Wheat' } },
  { date: 'Apr 27, 2026', badge: 'Baseline', color: 'gray'    as const, snapshot: { health: '81 / 100', attention: 1, status: 'Stable',    area: '144.8 ha', crop: 'Winter Wheat' } },
  { date: 'Apr 06, 2026', badge: 'Scan 2',   color: 'gray'    as const, snapshot: { health: '78 / 100', attention: 2, status: 'Improved',  area: '144.8 ha', crop: 'Winter Wheat' } },
  { date: 'Mar 16, 2026', badge: 'Scan 1',   color: 'gray'    as const, snapshot: { health: '69 / 100', attention: 4, status: 'Worsened',  area: '144.8 ha', crop: 'Winter Wheat' } },
]

function ScanAccordionItem({ scan }: { scan: typeof SCANS[number] }) {
  const [open, setOpen] = useState(false)
  const s = scan.snapshot

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 font-medium">{scan.date}</span>
          <Badge color={scan.color}>{scan.badge}</Badge>
        </div>
        {open ? <HiChevronUp className="w-4 h-4 text-gray-400" /> : <HiChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 grid grid-cols-2 gap-x-6 gap-y-2">
          {[
            { label: 'Crop Health',  value: s.health },
            { label: 'Attention',    value: `${s.attention} fields` },
            { label: 'Scan Status',  value: s.status },
            { label: 'Primary Crop', value: s.crop },
            { label: 'Total Area',   value: s.area },
          ].map((r) => (
            <div key={r.label} className="flex flex-col">
              <span className="text-[10px] text-gray-400">{r.label}</span>
              <span className="text-xs font-medium text-gray-800">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecentScansTab() {
  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="space-y-2">
        {SCANS.map((s) => <ScanAccordionItem key={s.date} scan={s} />)}
      </div>
    </div>
  )
}

// ─── Farm Summary tab ────────────────────────────────────────────────────────

const SUMMARY_ROWS = [
  { label: 'Total Area',                value: '144.8 ha' },
  { label: 'Primary Crop',              value: 'Winter Wheat' },
  { label: 'Total Fields',              value: '12' },
  { label: 'Last Upload',               value: 'Today, 10:42' },
  { label: 'Active Season',             value: 'Spring 2026' },
  { label: 'Farm Owner',                value: 'AgriGro Farms' },
  { label: 'Crop Health Score',         value: '74 / 100', badge: { text: 'Good', color: 'success' as const } },
  { label: 'Fields Requiring Attention', value: '3 (25%)' },
  { label: 'Last Scan Status',          value: 'Worsened',  badge: { text: '↓', color: 'failure' as const } },
]

function FarmSummaryTab() {
  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="divide-y divide-gray-100">
        {SUMMARY_ROWS.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2.5">
            <span className="text-sm text-gray-500">{r.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{r.value}</span>
              {r.badge && <Badge color={r.badge.color}>{r.badge.text}</Badge>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'scans' | 'summary'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Farm Overview' },
  { id: 'scans',    label: 'Recent Scans' },
  { id: 'summary',  label: 'Farm Summary' },
]

function OverviewPage() {
  const { farm } = useFarm()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const statCards = [
    {
      icon: HiLocationMarker, iconBg: 'bg-green-100', iconColor: 'text-green-700',
      label: 'Total Fields',
      value: farm?.meta.field_count != null ? String(farm.meta.field_count) : '—',
      sub:   farm?.meta.total_area_hectares != null ? `${farm.meta.total_area_hectares.toFixed(1)} ha` : undefined,
    },
    { icon: HiChartBar,    iconBg: 'bg-green-100',  iconColor: 'text-green-700',  label: 'Crop Health',     value: '74 / 100', badge: { text: 'Good',            color: 'success' as const } },
    { icon: HiExclamation, iconBg: 'bg-red-100',    iconColor: 'text-red-600',    label: 'Needs Attention', value: '3',        sub: '25% of fields' },
    { icon: HiRefresh,     iconBg: 'bg-purple-100', iconColor: 'text-purple-700', label: 'Last Scan',       value: 'Worsened', badge: { text: 'vs last scan ↓', color: 'failure' as const } },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden px-5 pt-4 pb-4 gap-3">

      <p className="text-sm font-semibold text-gray-400 tracking-wide flex-shrink-0">Overview</p>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2.5 flex items-center gap-3">
            <div className={`p-2 rounded-full flex-shrink-0 ${c.iconBg}`}>
              <c.icon className={`w-4 h-4 ${c.iconColor}`} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 leading-tight">{c.label}</p>
              <p className="text-base font-bold text-gray-900 leading-tight">{c.value}</p>
              {'sub'   in c && c.sub   && <p className="text-[10px] text-gray-400">{c.sub}</p>}
              {'badge' in c && c.badge && <Badge color={c.badge.color} className="mt-0.5 w-fit text-[10px]">{c.badge.text}</Badge>}
            </div>
          </div>
        ))}
      </div>

      {/* Tabbed pane */}
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 px-2 flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={[
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === t.id
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'overview' && <FarmOverviewTab />}
          {activeTab === 'scans'    && <RecentScansTab />}
          {activeTab === 'summary'  && <FarmSummaryTab />}
        </div>
      </div>

    </div>
  )
}
