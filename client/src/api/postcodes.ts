import type { Coordinates } from '../types/geo';

export async function geocodePostcode(postcode: string): Promise<Coordinates> {
  const encoded = encodeURIComponent(postcode.trim());
  const res = await fetch(`https://api.postcodes.io/postcodes/${encoded}`);
  if (!res.ok) {
    throw new Error('Postcode not found');
  }
  const data = await res.json();
  return {
    lat: data.result.latitude,
    lng: data.result.longitude,
  };
}
