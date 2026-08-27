import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { OnboardingState, OnboardingAction } from './types';

const initialState: OnboardingState = {
  currentStep: 1,
  postcode: '',
  coordinates: null,
  bbox: null,
  detectedFields: null,
  selectedFieldIds: new Set(),
  cropDetails: {},
  detectDone: false,
  visibleFieldCount: 0,
  isLoading: false,
  error: null,
  activeFieldId: null,
};

function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_POSTCODE':
      return { ...state, postcode: action.payload };
    case 'SET_COORDINATES':
      return { ...state, coordinates: action.payload };
    case 'SET_BBOX':
      return { ...state, bbox: action.payload };
    case 'SET_DETECTED_FIELDS':
      return { ...state, detectedFields: action.payload };
    case 'TOGGLE_FIELD': {
      const next = new Set(state.selectedFieldIds);
      if (next.has(action.payload)) {
        next.delete(action.payload);
      } else {
        next.add(action.payload);
      }
      return { ...state, selectedFieldIds: next };
    }
    case 'SET_CROP_DETAIL': {
      const { fieldId, cropType, sowingDate } = action.payload;
      return { ...state, cropDetails: { ...state.cropDetails, [fieldId]: { cropType, sowingDate } } };
    }
    case 'SET_DETECT_DONE':
      return { ...state, detectDone: action.payload };
    case 'SET_VISIBLE_FIELD_COUNT':
      return { ...state, visibleFieldCount: action.payload };
    case 'NEXT_STEP':
      return { ...state, currentStep: state.currentStep + 1 };
    case 'PREV_STEP':
      return { ...state, currentStep: Math.max(1, state.currentStep - 1) };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'GOTO_STEP':
      // Only allow backward navigation (can't skip ahead)
      return { ...state, currentStep: Math.min(action.payload, state.currentStep) };
    case 'SET_ACTIVE_FIELD':
      return { ...state, activeFieldId: action.payload };
    default:
      return state;
  }
}

const OnboardingContext = createContext<{
  state: OnboardingState;
  dispatch: React.Dispatch<OnboardingAction>;
} | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <OnboardingContext.Provider value={{ state, dispatch }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
