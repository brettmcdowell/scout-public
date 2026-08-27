import { useMapEvents } from 'react-leaflet';
import FieldPolygon from './FieldPolygon';
import type { FieldFeature } from '../../types/geo';

// Ray-casting point-in-polygon test for GeoJSON [lng, lat] rings
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

interface MapClickHandlerProps {
  features: FieldFeature[];
  onToggle: (id: string) => void;
}

function MapClickHandler({ features, onToggle }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      const { lng, lat } = e.latlng;
      // Find all polygons containing this point, pick the smallest (most specific)
      const hit = features
        .filter(f => pointInRing(lng, lat, f.geometry.coordinates[0]))
        .sort((a, b) => a.properties.area_hectares - b.properties.area_hectares);
      if (hit.length > 0) onToggle(hit[0].id);
    },
  });
  return null;
}

interface Props {
  features: FieldFeature[];
  selectedIds: Set<string>;
  onToggle?: (id: string) => void;
  animate?: boolean;
}

export default function FieldOverlay({ features, selectedIds, onToggle, animate }: Props) {
  return (
    <>
      {onToggle && <MapClickHandler features={features} onToggle={onToggle} />}
      {features.map((feature) => (
        <FieldPolygon
          key={feature.id}
          feature={feature}
          selected={selectedIds.has(feature.id)}
          animate={animate}
        />
      ))}
    </>
  );
}
