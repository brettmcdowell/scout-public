import type { FieldFeature } from '../types/geo'
import type { Scene, AnalysisData } from '../layers/intelligence/types'
import type { ContextData } from '../layers/context/types'

const CACHE_TTL_MS = 30 * 60 * 1000

// ─── Per-field pre-cache (first two dates, triggered during onboarding/farm load) ─

interface PreCacheEntry {
  scenes: Scene[]
  scanDateA: string | null
  scanDateB: string | null
  analysisA: AnalysisData | null
  analysisB: AnalysisData | null
  contextData: ContextData | null
  startedAt: number
}

const preCache = new Map<string, PreCacheEntry>()

export function getCachedEntry(fieldId: string): PreCacheEntry | null {
  const entry = preCache.get(fieldId)
  if (!entry) return null
  if (Date.now() - entry.startedAt > CACHE_TTL_MS) {
    preCache.delete(fieldId)
    return null
  }
  return entry
}

export function preCacheField(field: FieldFeature): void {
  const existing = preCache.get(field.id)
  if (existing && Date.now() - existing.startedAt < CACHE_TTL_MS) return

  preCache.set(field.id, {
    scenes: [], scanDateA: null, scanDateB: null,
    analysisA: null, analysisB: null, contextData: null,
    startedAt: Date.now(),
  })

  fetch('/api/intelligence/scenes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(field),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((scenes: Scene[]) => {
      const entry = preCache.get(field.id)
      if (!entry) return
      const dateA = scenes[0]?.date ?? null
      const dateB = scenes[1]?.date ?? null
      preCache.set(field.id, { ...entry, scenes, scanDateA: dateA, scanDateB: dateB })

      // Analysis A → then context
      const urlA = dateA ? `/api/intelligence/analyse?scene_date=${dateA}` : '/api/intelligence/analyse'
      fetch(urlA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(field),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((analysisA: AnalysisData) => {
          const e = preCache.get(field.id)
          if (!e) return
          preCache.set(field.id, { ...e, analysisA })
          if (dateA) memoizeAnalysis(field.id, dateA, analysisA)

          const params = new URLSearchParams()
          params.set('ndvi', (analysisA.stats.cropHealthScore / 100).toFixed(3))
          if (analysisA.stats.ndmiScore != null) params.set('ndmi', (analysisA.stats.ndmiScore / 100).toFixed(3))
          if (analysisA.stats.ndwiScore != null) params.set('ndwi', (analysisA.stats.ndwiScore / 100).toFixed(3))
          fetch(`/api/context/analyse?${params.toString()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(field),
          })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((contextData: ContextData) => {
              const e2 = preCache.get(field.id)
              if (e2) preCache.set(field.id, { ...e2, contextData })
            })
            .catch(() => {})
        })
        .catch(() => {})

      // Analysis B in parallel (no context needed for B)
      if (dateB) {
        fetch(`/api/intelligence/analyse?scene_date=${dateB}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(field),
        })
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((analysisB: AnalysisData) => {
            const e = preCache.get(field.id)
            if (!e) return
            preCache.set(field.id, { ...e, analysisB })
            memoizeAnalysis(field.id, dateB, analysisB)
          })
          .catch(() => {})
      }
    })
    .catch(() => {})
}

// ─── Per-(field, date) memo (populated by pre-cache + in-app fetches) ─────────

const analysisDateMemo = new Map<string, AnalysisData>()

function memoKey(fieldId: string, date: string): string {
  return `${fieldId}:${date}`
}

export function getMemoizedAnalysis(fieldId: string, date: string): AnalysisData | null {
  return analysisDateMemo.get(memoKey(fieldId, date)) ?? null
}

export function memoizeAnalysis(fieldId: string, date: string, data: AnalysisData): void {
  analysisDateMemo.set(memoKey(fieldId, date), data)
}
