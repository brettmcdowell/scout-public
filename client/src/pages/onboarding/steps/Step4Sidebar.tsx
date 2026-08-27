import { useState } from 'react';
import { useOnboarding } from '../OnboardingContext';
import type { FieldFeature } from '../../../types/geo';

type Cardinal = 'North' | 'East' | 'South' | 'West';
const CARDINAL_ORDER: Cardinal[] = ['North', 'East', 'South', 'West'];

function fieldCentroid(f: FieldFeature): [number, number] {
  const coords = f.geometry.coordinates[0]; // [lng, lat][]
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

function FieldRow({
  field, selected, onToggle,
}: {
  field: FieldFeature;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        selected ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(field.id)}
        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{field.properties.name}</p>
        <p className="text-xs text-gray-500">{field.properties.area_hectares.toFixed(1)} ha</p>
      </div>
    </label>
  );
}

function GroupAccordion({
  label, fields, selectedIds, onToggle, defaultOpen,
}: {
  label: Cardinal;
  fields: FieldFeature[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const selectedCount = fields.filter(f => selectedIds.has(f.id)).length;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-700 font-medium">{selectedCount}/{fields.length}</span>
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="p-1 space-y-0.5 bg-white">
          {fields.map(f => (
            <FieldRow key={f.id} field={f} selected={selectedIds.has(f.id)} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Step4Sidebar() {
  const { state, dispatch } = useOnboarding();
  const fields = state.detectedFields?.features ?? [];
  const selectedCount = state.selectedFieldIds.size;
  const totalHa = fields
    .filter(f => state.selectedFieldIds.has(f.id))
    .reduce((s, f) => s + f.properties.area_hectares, 0);

  function handleToggle(id: string) {
    dispatch({ type: 'TOGGLE_FIELD', payload: id });
  }
  function selectAll() {
    fields.forEach(f => {
      if (!state.selectedFieldIds.has(f.id)) dispatch({ type: 'TOGGLE_FIELD', payload: f.id });
    });
  }
  function clearAll() {
    fields.forEach(f => {
      if (state.selectedFieldIds.has(f.id)) dispatch({ type: 'TOGGLE_FIELD', payload: f.id });
    });
  }

  const grouped = fields.length > 10 && state.coordinates;

  // Group by compass direction when field count warrants it
  const groups: Record<Cardinal, FieldFeature[]> = { North: [], East: [], South: [], West: [] };
  if (grouped && state.coordinates) {
    fields.forEach(f => {
      const [lat, lng] = fieldCentroid(f);
      groups[getCardinal(lat, lng, state.coordinates!.lat, state.coordinates!.lng)].push(f);
    });
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Postcode root header */}
      {state.postcode && (
        <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Location</p>
          <p className="text-base font-bold text-gray-900 tracking-wide">{state.postcode}</p>
        </div>
      )}
      {/* Sub-header */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-medium text-gray-500">
          {selectedCount} selected{selectedCount > 0 && ` · ${totalHa.toFixed(1)} ha`}
        </span>
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-xs text-green-600 hover:text-green-700 font-medium">
            Select all
          </button>
          <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-600 font-medium">
            Clear
          </button>
        </div>
      </div>

      {/* Field list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {grouped ? (
          // Grouped accordion view for large field counts
          CARDINAL_ORDER.filter(dir => groups[dir].length > 0).map((dir, i) => (
            <GroupAccordion
              key={dir}
              label={dir}
              fields={groups[dir]}
              selectedIds={state.selectedFieldIds}
              onToggle={handleToggle}
              defaultOpen={false}
            />
          ))
        ) : (
          // Flat list for small field counts
          fields.map(f => (
            <FieldRow key={f.id} field={f} selected={state.selectedFieldIds.has(f.id)} onToggle={handleToggle} />
          ))
        )}
      </div>
    </div>
  );
}
