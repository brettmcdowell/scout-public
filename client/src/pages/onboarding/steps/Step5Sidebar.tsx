import { useState } from 'react';
import { useOnboarding } from '../OnboardingContext';
import type { FieldFeature } from '../../../types/geo';

type Cardinal = 'North' | 'East' | 'South' | 'West';
const CARDINAL_ORDER: Cardinal[] = ['North', 'East', 'South', 'West'];

function fieldCentroid(f: FieldFeature): [number, number] {
  const coords = f.geometry.coordinates[0];
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  return [lat, lng];
}

function getCardinal(lat: number, lng: number, cLat: number, cLng: number): Cardinal {
  const dLat = lat - cLat;
  const dLng = lng - cLng;
  if (Math.abs(dLat) >= Math.abs(dLng)) return dLat >= 0 ? 'North' : 'South';
  return dLng > 0 ? 'East' : 'West';
}

function GroupAccordion({
  label, fields,
}: {
  label: Cardinal;
  fields: FieldFeature[];
}) {
  const [open, setOpen] = useState(false);
  const groupHa = fields.reduce((s, f) => s + f.properties.area_hectares, 0);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-700 font-medium">{fields.length} field{fields.length !== 1 ? 's' : ''} · {groupHa.toFixed(1)} ha</span>
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="bg-white px-3 py-1 space-y-0">
          {fields.map(f => (
            <div key={f.id} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-900">{f.properties.name}</span>
              <span className="text-sm text-gray-500">{f.properties.area_hectares.toFixed(1)} ha</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Step5Sidebar() {
  const { state } = useOnboarding();

  const selectedFields = (state.detectedFields?.features ?? []).filter(f =>
    state.selectedFieldIds.has(f.id)
  );
  const totalHa = selectedFields.reduce((sum, f) => sum + f.properties.area_hectares, 0);
  const useGroups = selectedFields.length > 10 && state.coordinates;

  const groups: Record<Cardinal, FieldFeature[]> = { North: [], East: [], South: [], West: [] };
  if (useGroups && state.coordinates) {
    selectedFields.forEach(f => {
      const [lat, lng] = fieldCentroid(f);
      groups[getCardinal(lat, lng, state.coordinates!.lat, state.coordinates!.lng)].push(f);
    });
  }

  return (
    <div className="h-full flex flex-col gap-4 min-h-0">
      {/* Scrollable selection list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0">
        {/* Postcode root header */}
        {state.postcode && (
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Location</p>
            <p className="text-base font-bold text-gray-900 tracking-wide">{state.postcode}</p>
          </div>
        )}

        <div className="p-3 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">Your Selection</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
          {useGroups ? (
            CARDINAL_ORDER.filter(dir => groups[dir].length > 0).map(dir => (
              <GroupAccordion key={dir} label={dir} fields={groups[dir]} />
            ))
          ) : (
            selectedFields.map(f => (
              <div key={f.id} className="flex justify-between px-3 py-1.5">
                <span className="text-sm text-gray-900">{f.properties.name}</span>
                <span className="text-sm text-gray-500">{f.properties.area_hectares.toFixed(1)} ha</span>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-gray-100 flex justify-between flex-shrink-0">
          <span className="text-sm font-bold text-gray-900">Total</span>
          <span className="text-sm font-bold text-green-700">{totalHa.toFixed(1)} ha</span>
        </div>
      </div>

      {/* Always-visible footer */}
      <div className="flex-shrink-0 bg-green-50 rounded-xl border border-green-100 p-4">
        <h4 className="text-sm font-semibold text-green-900 mb-1">What happens next?</h4>
        <p className="text-xs text-green-800 leading-relaxed">
          We'll start monitoring your fields with satellite imagery and provide crop health insights,
          anomaly detection, and actionable recommendations.
        </p>
      </div>
    </div>
  );
}
