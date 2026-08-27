import { Card, Badge } from 'flowbite-react'
import { HiChartBar, HiExclamationCircle, HiCollection, HiTrendingUp, HiStar } from 'react-icons/hi'
import type { AnalysisStats } from './types'

const BADGE_COLOUR = {
  Good: 'success',
  Worsened: 'failure',
  Stable: 'warning',
  Improving: 'success',
  'Very High': 'purple',
  High: 'warning',
} as const

interface Props { stats: AnalysisStats | undefined }

export function StatCards({ stats }: Props) {
  if (!stats) {
    return (
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="shadow-sm animate-pulse h-24" />
        ))}
      </div>
    )
  }

  const cards = [
    {
      icon: HiChartBar,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-700',
      label: 'Crop Health Score',
      value: `${stats.cropHealthScore} / ${stats.maxScore}`,
      badge: { text: stats.scoreLabel, color: BADGE_COLOUR[stats.scoreLabel as keyof typeof BADGE_COLOUR] ?? 'gray' },
    },
    {
      icon: HiExclamationCircle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      label: 'Abnormal Zones',
      value: String(stats.abnormalZones),
      sub: '— vs last scan',
      badge: null,
    },
    {
      icon: HiCollection,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      label: 'Affected Area',
      value: `${stats.affectedAreaHa} ha`,
      sub: `${stats.affectedAreaPct}% of field`,
      badge: null,
    },
    {
      icon: HiTrendingUp,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      label: 'Trend vs Last Scan',
      value: stats.trend,
      badge: { text: stats.trendDelta, color: 'failure' as const },
    },
    {
      icon: HiStar,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-700',
      label: 'Top Priority',
      value: stats.topPriority,
      badge: { text: stats.topPriorityLevel, color: 'purple' as const },
    },
  ]

  return (
    <div className="grid grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="shadow-sm">
          <div className="flex items-start gap-2.5">
            <div className={`p-2 rounded-full flex-shrink-0 ${c.iconBg}`}>
              <c.icon className={`w-4 h-4 ${c.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 truncate">{c.label}</p>
              <p className="text-lg font-bold text-gray-900 leading-tight truncate">{c.value}</p>
              {'sub' in c && c.sub && <p className="text-[11px] text-gray-400">{c.sub}</p>}
              {c.badge && (
                <Badge color={c.badge.color} className="mt-1 w-fit text-[10px]">
                  {c.badge.text}
                </Badge>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
