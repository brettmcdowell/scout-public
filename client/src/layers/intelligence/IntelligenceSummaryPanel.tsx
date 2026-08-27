import { Button, Badge } from 'flowbite-react'
import { HiDownload, HiArrowRight } from 'react-icons/hi'
import { SEVERITY_COLOURS } from './types'
import type { AnalysisData, Zone } from './types'
import type { FieldFeature } from '../../types/geo'

function ZoneBadge({ zone }: { zone: Zone }) {
  const color = SEVERITY_COLOURS[zone.severity]
  const badgeColor =
    zone.severity === 'Very High' ? 'failure' :
    zone.severity === 'High'      ? 'warning' :
    zone.severity === 'Improving' ? 'success' : 'gray'

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <span
          className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
          style={{ background: color }}
        >
          {zone.id}
        </span>
        <span className="text-xs text-gray-700">{zone.name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-gray-400">{zone.areaHa} ha</span>
        <Badge color={badgeColor} className="text-[9px] py-0">{zone.severity}</Badge>
      </div>
    </div>
  )
}

interface Props {
  analysisData: AnalysisData
  field: FieldFeature | null
}

export function IntelligenceSummaryPanel({ analysisData, field }: Props) {
  const { stats, zones, detected_signals } = analysisData
  const topZone = zones.find((z) => z.name === stats.topPriority) ?? zones[0]
  const fieldLabel = field
    ? `${field.properties.name} — ${field.properties.area_hectares.toFixed(1)} ha`
    : '—'

  return (
    <div className="flex flex-col gap-1.5">

      {/* Field summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-2">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Field Summary</p>
        <p className="text-xs font-semibold text-gray-800 mb-2">{fieldLabel}</p>
        <ul className="space-y-1">
          <li className="flex items-start gap-1.5 text-[10px] text-gray-600">
            <span className={`mt-0.5 flex-shrink-0 ${stats.abnormalZones > 0 ? 'text-red-500' : 'text-green-600'}`}>●</span>
            {stats.abnormalZones > 0
              ? `${stats.abnormalZones} zone${stats.abnormalZones > 1 ? 's' : ''} require attention`
              : 'All zones in good condition'}
          </li>
          <li className="flex items-start gap-1.5 text-[10px] text-gray-600">
            <span className="text-orange-400 mt-0.5 flex-shrink-0">◆</span>
            Crop health: <strong className="ml-0.5">{stats.cropHealthScore}/100 — {stats.scoreLabel}</strong>
          </li>
          <li className="flex items-start gap-1.5 text-[10px] text-gray-600">
            <span className="text-blue-400 mt-0.5 flex-shrink-0">◆</span>
            {stats.affectedAreaHa} ha ({stats.affectedAreaPct}%) showing stress indicators
          </li>
          {stats.topPriority !== '—' && (
            <li className="flex items-start gap-1.5 text-[10px] text-gray-600">
              <span className="text-red-500 mt-0.5 flex-shrink-0">▲</span>
              Scout <strong className="ml-0.5">{stats.topPriority}</strong> first — {stats.topPriorityLevel} priority
            </li>
          )}
        </ul>
      </div>

      {/* Zone severity */}
      <div className="bg-white rounded-xl border border-gray-200 p-2">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Zone Severity</p>
        {zones.map((z) => <ZoneBadge key={z.id} zone={z} />)}
      </div>

      {/* Detected signals */}
      {detected_signals.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Detected Signals</p>
          <div className="space-y-2">
            {detected_signals.map((s, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-sm leading-none flex-shrink-0 mt-0.5">{s.icon}</span>
                <div>
                  <p className="text-[10px] font-semibold text-gray-800">{s.title}</p>
                  <p className="text-[10px] text-gray-500 leading-snug">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Go here first */}
      {topZone && stats.topPriority !== '—' && (
        <div className="bg-white rounded-xl border border-gray-200 p-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Go Here First</p>
          <div className="flex items-start gap-2">
            <span
              className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
              style={{ background: SEVERITY_COLOURS[topZone.severity] }}
            >
              {topZone.id}
            </span>
            <div>
              <p className="text-xs font-semibold text-gray-900">{topZone.name}</p>
              <p className="text-[11px] text-gray-500">{topZone.areaHa} ha stressed · {topZone.severity} priority</p>
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="space-y-1.5 pt-1">
        <Button color="success" className="w-full" size="sm">
          <HiDownload className="mr-2 w-4 h-4" />
          Download Report
        </Button>
        <Button color="success" outline className="w-full" size="sm">
          Open Action Report
          <HiArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
