import type { BoundingBox, Coordinates, FieldCollection } from '../types/geo';

export async function detectFields(
  bbox: BoundingBox,
  center: Coordinates
): Promise<FieldCollection> {
  const res = await fetch('/api/fields/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bbox, center }),
  });
  if (!res.ok) {
    throw new Error('Field detection failed');
  }
  return res.json();
}
