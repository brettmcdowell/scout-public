import { Card, Badge } from 'flowbite-react'
import type { DetectedSignal } from './types'

const SEVERITY_BADGE = {
  High: 'failure',
  Medium: 'warning',
  Low: 'success',
} as const

interface Props { signals: DetectedSignal[] | undefined }

export function DetectedSignals({ signals }: Props) {
  const items = signals ?? []

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Detected Signals</h2>
      <div className="grid grid-cols-4 gap-3">
        {items.map((s) => (
          <Card key={s.title} className="shadow-sm">
            <div className="flex flex-col gap-2">
              <span className="text-2xl">{s.icon}</span>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{s.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{s.description}</p>
              <Badge color={SEVERITY_BADGE[s.severity]} className="w-fit">{s.severity}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
