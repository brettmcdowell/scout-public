export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface FieldProperties {
  name: string;
  area_hectares: number;
  perimeter_m: number;
  crop_type?: string;
  sowing_date?: string;
}

export interface FieldFeature {
  type: 'Feature';
  id: string;
  properties: FieldProperties;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface FieldCollection {
  type: 'FeatureCollection';
  features: FieldFeature[];
}

export interface FarmMeta {
  farm_id: string;
  postcode: string;
  center: Coordinates;
  field_count: number;
  total_area_hectares: number;
  created_at: string;
}

export interface Farm {
  meta: FarmMeta;
  fields: FieldCollection;
}
