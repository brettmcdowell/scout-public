import { useState, useEffect } from 'react'
import { useOnboarding } from '../OnboardingContext'
import { preCacheField } from '../../../lib/analysisCache'

const CROP_OPTIONS = [
  { value: '', label: 'Select crop…' },
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

interface Props {
  onAllVisited: () => void
}

export default function Step5b_CropDetails({ onAllVisited }: Props) {
  const { state, dispatch } = useOnboarding()

  const selectedFields = (state.detectedFields?.features ?? []).filter(f =>
    state.selectedFieldIds.has(f.id)
  )
  const total = selectedFields.length

  const [activeIndex, setActiveIndex] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const field = selectedFields[activeIndex]
  const isFirst = activeIndex === 0
  const isLast = activeIndex === total - 1

  // Kick off background analysis pre-cache as soon as the user reaches this step
  useEffect(() => {
    selectedFields.forEach(preCacheField)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync active field id to context so the map can focus it (only while filling in)
  useEffect(() => {
    if (field && !submitted) dispatch({ type: 'SET_ACTIVE_FIELD', payload: field.id })
  }, [field?.id, submitted]) // eslint-disable-line react-hooks/exhaustive-deps

  // Whole-panel completion state — shown after the user explicitly presses Submit
  if (submitted) {
    return (
      <div className="h-full flex flex-col bg-green-600 rounded-xl border border-green-700 shadow-sm overflow-hidden items-center justify-center text-center px-8">
        <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center mb-5">
          <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">All fields complete</h2>
        <p className="text-sm text-green-100 leading-relaxed">
          Crop details saved for {total} field{total !== 1 ? 's' : ''}.<br />
          Press Confirm & Save to finish.
        </p>
      </div>
    )
  }

  if (!field) return null

  const detail = state.cropDetails[field.id] ?? { cropType: '', sowingDate: '' }
  const progressPct = total > 1 ? (activeIndex / (total - 1)) * 100 : 100

  const today = new Date().toISOString().split('T')[0]
  const tenYearsAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 10)).toISOString().split('T')[0]
  const dateInvalid = !!detail.sowingDate && (detail.sowingDate < tenYearsAgo || detail.sowingDate > today)
  const currentFieldFilled = !!detail.cropType && !!detail.sowingDate && !dateInvalid

  function go(dir: -1 | 1) {
    setActiveIndex(i => Math.max(0, Math.min(total - 1, i + dir)))
  }

  function handleSubmit() {
    dispatch({ type: 'SET_ACTIVE_FIELD', payload: null })
    setSubmitted(true)
    onAllVisited()
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
        <h2 className="text-lg font-bold text-gray-900">Crop details</h2>
        <p className="text-xs text-gray-400 mt-0.5">Add details for each field to unlock analysis</p>

        {/* Progress bar + fraction */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-500 tabular-nums shrink-0">
            {activeIndex + 1}/{total}
          </span>
        </div>
      </div>

      {/* Field content */}
      <div className="flex-1 px-5 py-5 flex flex-col min-h-0">
        <div className="mb-5">
          <p className="text-base font-semibold text-gray-900">{field.properties.name}</p>
          <p className="text-sm text-gray-400">{field.properties.area_hectares.toFixed(1)} ha</p>
        </div>

        {/* Crop type */}
        <div className="mb-4">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
            Crop type <span className="text-red-500 normal-case">*</span>
          </label>
          <select
            value={detail.cropType}
            onChange={e => dispatch({
              type: 'SET_CROP_DETAIL',
              payload: { fieldId: field.id, cropType: e.target.value, sowingDate: detail.sowingDate },
            })}
            className="w-full text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {CROP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Sowing date */}
        <div className="mb-6">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
            Sowing / planting date <span className="text-red-500 normal-case">*</span>
          </label>
          <input
            type="date"
            value={detail.sowingDate}
            min={tenYearsAgo}
            max={today}
            onChange={e => dispatch({
              type: 'SET_CROP_DETAIL',
              payload: { fieldId: field.id, cropType: detail.cropType, sowingDate: e.target.value },
            })}
            className={`w-full text-sm text-gray-700 border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 ${dateInvalid ? 'border-red-400' : 'border-gray-300'}`}
          />
          {dateInvalid && (
            <p className="text-xs text-red-500 mt-1">Date must be within the last 10 years.</p>
          )}
        </div>

        {/* Prev / Next / Submit navigation */}
        <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => go(-1)}
            disabled={isFirst}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={!currentFieldFilled}
              className="flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:text-green-900 disabled:opacity-25 disabled:cursor-not-allowed transition-opacity"
            >
              Submit
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => go(1)}
              disabled={!currentFieldFilled}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-25 disabled:cursor-not-allowed transition-opacity"
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
