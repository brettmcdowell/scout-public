import { MapContainer, TileLayer } from 'react-leaflet';
import type { ReactNode } from 'react';
import { ESRI_SATELLITE_URL, ESRI_ATTRIBUTION } from './constants';

interface Props {
  center: [number, number];
  zoom: number;
  children?: ReactNode;
}

export default function SatelliteMap({ center, zoom, children }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="w-full h-full"
      zoomControl={false}
    >
      <TileLayer url={ESRI_SATELLITE_URL} attribution={ESRI_ATTRIBUTION} maxZoom={19} />
      {children}
    </MapContainer>
  );
}
