import type { Coordinates, FieldFeature, Farm } from '../types/geo';

interface SavePayload {
  postcode: string;
  center: Coordinates;
  selected_fields: FieldFeature[];
}

interface SaveResponse {
  status: string;
  farm_id: string;
  field_count: number;
  total_area_hectares: number;
}

export async function saveOnboarding(payload: SavePayload): Promise<SaveResponse> {
  const res = await fetch('/api/onboarding/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to save onboarding data');
  }
  return res.json();
}

export async function fetchFarm(farmId: string): Promise<Farm> {
  const res = await fetch(`/api/farms/${farmId}`);
  if (!res.ok) throw new Error('Failed to fetch farm');
  return res.json();
}

export async function fetchLatestFarm(): Promise<Farm> {
  const res = await fetch('/api/farms/latest');
  if (!res.ok) throw new Error('Failed to fetch latest farm');
  return res.json();
}
