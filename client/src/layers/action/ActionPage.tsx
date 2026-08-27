import type { ComponentType } from 'react'
import { HiExclamation, HiEye, HiBeaker, HiRefresh, HiTrendingUp, HiDownload } from 'react-icons/hi'

type Priority = 'High' | 'Medium'
type Category = 'Pest / Disease' | 'Irrigation' | 'Nutrition' | 'Monitoring'

type Action = {
  priority: Priority
  field: string
  zone: string
  action: string
  detail: string
  upsideLabel: string
  upsideValue: string
  category: Category
}

const TOP_ACTIONS: Action[] = [
  {
    priority: 'High',
    field: 'Field 3',
    zone: 'NW Zone',
    action: 'Apply fungicide spray',
    detail: 'NDVI fell 40% since baseline — stress pattern consistent with fungal spread.',
    upsideLabel: 'Est. yield loss prevented',
    upsideValue: '£820',
    category: 'Pest / Disease',
  },
  {
    priority: 'High',
    field: 'Field 3',
    zone: 'Central',
    action: 'Irrigate & soil moisture test',
    detail: 'Central NDVI at 0.32 — severe stress, likely moisture deficit across 42% of field.',
    upsideLabel: 'Projected NDVI recovery',
    upsideValue: '+0.28 pts',
    category: 'Irrigation',
  },
  {
    priority: 'Medium',
    field: 'Field 4',
    zone: 'Centre',
    action: 'Targeted nitrogen top-dressing',
    detail: 'Centre zone NDVI 0.42 — selective N application avoids over-input to healthier zones.',
    upsideLabel: 'Input cost reduction',
    upsideValue: '~8%',
    category: 'Nutrition',
  },
  {
    priority: 'Medium',
    field: 'Field 2',
    zone: 'SE Zone',
    action: 'Precision irrigation check',
    detail: 'SE zone tracking 0.08 pts below baseline — early soil moisture imbalance suspected.',
    upsideLabel: 'Water use reduction',
    upsideValue: '~12%',
    category: 'Irrigation',
  },
]

const PRIORITY_CONFIG: Record<Priority, { dot: string; pill: string; bar: string }> = {
  High:   { dot: 'bg-red-500',    pill: 'bg-red-50 text-red-700 border border-red-200',         bar: 'bg-red-500' },
  Medium: { dot: 'bg-yellow-400', pill: 'bg-yellow-50 text-yellow-700 border border-yellow-200', bar: 'bg-yellow-400' },
}

const CATEGORY_CONFIG: Record<Category, { icon: ComponentType<{ className?: string }>; color: string }> = {
  'Pest / Disease': { icon: HiExclamation, color: 'text-red-500 bg-red-50' },
  'Irrigation':     { icon: HiRefresh,     color: 'text-blue-500 bg-blue-50' },
  'Nutrition':      { icon: HiBeaker,      color: 'text-purple-500 bg-purple-50' },
  'Monitoring':     { icon: HiEye,         color: 'text-gray-500 bg-gray-50' },
}

export function ActionPage() {
  const highCount      = TOP_ACTIONS.filter((a) => a.priority === 'High').length
  const fieldsAffected = [...new Set(TOP_ACTIONS.map((a) => a.field))].length

  return (
    <div className="h-full flex flex-col overflow-hidden px-5 pt-4 pb-4 gap-3">
      <p className="text-sm font-semibold text-gray-400 tracking-wide flex-shrink-0">Action</p>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">High Priority</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{highCount}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">require immediate action</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Est. Value at Risk</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">£1,020</p>
          <p className="text-[10px] text-gray-400 mt-0.5">if left unresolved</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Fields Affected</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{fieldsAffected} of 6</p>
          <p className="text-[10px] text-gray-400 mt-0.5">have active actions</p>
        </div>

        {/* Download CTA */}
        <button className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl px-4 py-3 text-left transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-green-200 uppercase tracking-wide">May 14, 2026</p>
            <HiDownload className="w-4 h-4 text-green-200" />
          </div>
          <div className="mt-1">
            <p className="text-base font-bold text-white leading-tight">Download Full</p>
            <p className="text-sm font-semibold text-green-200 leading-tight">Action Report</p>
          </div>
        </button>
      </div>

      {/* ── 2×2 action grid ── */}
      <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-3">
        {TOP_ACTIONS.map((action, i) => {
          const pCfg = PRIORITY_CONFIG[action.priority]
          const cCfg = CATEGORY_CONFIG[action.category]
          const CatIcon = cCfg.icon
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
              {/* Priority accent bar */}
              <div className={`h-1 flex-shrink-0 ${pCfg.bar}`} />

              <div className="flex-1 p-6 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${pCfg.dot}`} />
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pCfg.pill}`}>
                      {action.priority} Priority
                    </span>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cCfg.color}`}>
                    <CatIcon className="w-3.5 h-3.5" />
                    {action.category}
                  </div>
                </div>

                {/* Field + zone */}
                <p className="text-sm font-medium text-gray-400 mb-2">{action.field} · {action.zone}</p>

                {/* Action — hero */}
                <p className="text-2xl font-bold text-gray-900 leading-snug mb-3">{action.action}</p>

                {/* Detail */}
                <p className="text-sm text-gray-500 leading-relaxed flex-1">{action.detail}</p>

                {/* Upside */}
                <div className="flex items-end justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <HiTrendingUp className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-gray-500">{action.upsideLabel}</span>
                  </div>
                  <span className="text-2xl font-bold text-green-700">{action.upsideValue}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
