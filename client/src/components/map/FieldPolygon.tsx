import { Polygon, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { FieldFeature } from '../../types/geo';
import type { LatLngExpression } from 'leaflet';

interface Props {
  feature: FieldFeature;
  selected: boolean;
  onClick?: (id: string) => void;
  animate?: boolean;
  active?: boolean;
  permanentLabel?: boolean;
}

export default function FieldPolygon({ feature, selected, onClick, animate, active, permanentLabel }: Props) {
  // GeoJSON coordinates are [lng, lat], Leaflet needs [lat, lng]
  const positions: LatLngExpression[] = feature.geometry.coordinates[0].map(
    ([lng, lat]) => [lat, lng] as [number, number]
  );

  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: active ? '#16a34a' : selected ? '#22c55e' : '#ef4444',
        weight: active ? 4 : selected ? 3 : 2,
        fillColor: active ? '#16a34a' : '#22c55e',
        fillOpacity: active ? 0.55 : selected ? 0.4 : 0,
        className: animate ? 'field-polygon-animate' : undefined,
      }}
      eventHandlers={onClick ? {
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          onClick(feature.id);
        },
      } : {}}
    >
      {permanentLabel ? (
        <Tooltip permanent direction="top">
          <strong>{feature.properties.name}</strong>
          <br />
          {feature.properties.area_hectares.toFixed(1)} ha
        </Tooltip>
      ) : (
        <Tooltip sticky>
          <strong>{feature.properties.name}</strong>
          <br />
          {feature.properties.area_hectares.toFixed(1)} ha
        </Tooltip>
      )}
    </Polygon>
  );
}
