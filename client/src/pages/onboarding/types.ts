import type { Coordinates, BoundingBox, FieldCollection } from '../../types/geo';

export interface CropDetail {
  cropType: string;
  sowingDate: string;
}

export interface OnboardingState {
  currentStep: number;
  postcode: string;
  coordinates: Coordinates | null;
  bbox: BoundingBox | null;
  detectedFields: FieldCollection | null;
  selectedFieldIds: Set<string>;
  cropDetails: Record<string, CropDetail>;
  detectDone: boolean;
  visibleFieldCount: number;
  isLoading: boolean;
  error: string | null;
  activeFieldId: string | null;
}

export type OnboardingAction =
  | { type: 'SET_POSTCODE'; payload: string }
  | { type: 'SET_COORDINATES'; payload: Coordinates }
  | { type: 'SET_BBOX'; payload: BoundingBox }
  | { type: 'SET_DETECTED_FIELDS'; payload: FieldCollection }
  | { type: 'TOGGLE_FIELD'; payload: string }
  | { type: 'SET_CROP_DETAIL'; payload: { fieldId: string } & CropDetail }
  | { type: 'SET_DETECT_DONE'; payload: boolean }
  | { type: 'SET_VISIBLE_FIELD_COUNT'; payload: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'GOTO_STEP'; payload: number }
  | { type: 'SET_ACTIVE_FIELD'; payload: string | null };
