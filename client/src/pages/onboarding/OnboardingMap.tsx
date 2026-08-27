import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap, Polygon } from 'react-leaflet';
import L from 'leaflet';
import SatelliteMap from '../../components/map/SatelliteMap';
import FieldPolygon from '../../components/map/FieldPolygon';
import FieldOverlay from '../../components/map/FieldOverlay';
import { useOnboarding } from './OnboardingContext';
import { detectFields } from '../../api/fields';
import type { FieldFeature } from '../../types/geo';

/** Step 2: fly to the geocoded postcode */
function FlyToHandler({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const { dispatch } = useOnboarding();
  const completed = useRef(false);

  useEffect(() => {
    if (completed.current) return;

    map.invalidateSize();
    map.setView([lat, lng], 10, { animate: false });

    const timer = setTimeout(() => {
      map.invalidateSize();
      map.flyTo([lat, lng], 15, { duration: 2 });

      const onEnd = () => {
        if (completed.current) return;
        completed.current = true;
        map.off('moveend', onEnd);
        setTimeout(() => dispatch({ type: 'NEXT_STEP' }), 600);
      };
      map.once('moveend', onEnd);
    }, 150);

    return () => clearTimeout(timer);
  }, [map, lat, lng, dispatch]);

  return null;
}

/** Locks the map to the detected bbox so user can't pan/zoom out past it */
function MaxBoundsController() {
  const { state } = useOnboarding();
  const map = useMap();
  const applied = useRef(false);

  useEffect(() => {
    if (state.bbox && !applied.current) {
      applied.current = true;
      const bounds = L.latLngBounds(
        [state.bbox.south, state.bbox.west],
        [state.bbox.north, state.bbox.east],
      );
      // Viscosity 1.0 = hard wall, user cannot pan past bounds at all
      map.options.maxBoundsViscosity = 1.0;
      map.setMaxBounds(bounds.pad(0.25));
      // Allow one zoom level out from landing zoom so fields are visible
      map.setMinZoom(Math.round(map.getZoom()) - 1);
    }
  }, [map, state.bbox]);

  return null;
}

/** Step 3: extract bbox, run detection, animate polygons */
function DetectionController() {
  const { state, dispatch } = useOnboarding();
  const [visibleFields, setVisibleFields] = useState<FieldFeature[]>([]);
  const fetchedRef = useRef(false);

  const runDetection = useCallback(async () => {
    if (fetchedRef.current || !state.coordinates) return;
    fetchedRef.current = true;

    const center = state.coordinates;
    const offset = 0.005;
    const lngOffset = offset / Math.cos((center.lat * Math.PI) / 180);
    const bbox = {
      north: center.lat + offset,
      south: center.lat - offset,
      east: center.lng + lngOffset,
      west: center.lng - lngOffset,
    };

    dispatch({ type: 'SET_BBOX', payload: bbox });

    try {
      const result = await detectFields(bbox, center);
      dispatch({ type: 'SET_DETECTED_FIELDS', payload: result });

      result.features.forEach((feature, i) => {
        setTimeout(() => {
          setVisibleFields((prev) => [...prev, feature]);
          dispatch({ type: 'SET_VISIBLE_FIELD_COUNT', payload: i + 1 });
          if (i === result.features.length - 1) {
            setTimeout(() => {
              dispatch({ type: 'SET_DETECT_DONE', payload: true });
              dispatch({ type: 'NEXT_STEP' });
            }, 800);
          }
        }, (i + 1) * 50);
      });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to detect fields' });
    }
  }, [state.coordinates, dispatch]);

  useEffect(() => {
    if (state.currentStep === 3 && !fetchedRef.current) {
      const timer = setTimeout(runDetection, 300);
      return () => clearTimeout(timer);
    }
  }, [state.currentStep, runDetection]);

  return (
    <>
      {visibleFields.map((f) => (
        <FieldPolygon key={f.id} feature={f} selected={false} animate />
      ))}
    </>
  );
}

/** Step 6: fly to whichever field is currently active in the crop details step */
function FlyToActiveField() {
  const { state } = useOnboarding();
  const map = useMap();
  const prevIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.currentStep !== 6 || !state.activeFieldId) return;
    if (state.activeFieldId === prevIdRef.current) return;
    prevIdRef.current = state.activeFieldId;

    const field = (state.detectedFields?.features ?? []).find(f => f.id === state.activeFieldId);
    if (!field) return;

    const allCoords = field.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
    map.fitBounds(L.latLngBounds(allCoords), { padding: [80, 80], animate: false });
  }, [state.activeFieldId, state.currentStep, state.detectedFields, map]);

  return null;
}

/** Step 5: fit map to selected fields */
function FitBounds({ features }: { features: FieldFeature[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || features.length === 0) return;
    fitted.current = true;

    const allCoords = features.flatMap((f) =>
      f.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
    );
    const bounds = L.latLngBounds(allCoords);
    map.flyToBounds(bounds, { padding: [60, 60], duration: 1 });
  }, [map, features]);

  return null;
}

/** Recalculate map size when the layout changes (e.g. sidebar appears) */
function InvalidateSizeOnStep() {
  const map = useMap();
  const { state } = useOnboarding();

  useEffect(() => {
    const mid = setTimeout(() => map.invalidateSize(), 250);
    const end = setTimeout(() => map.invalidateSize(), 550);
    return () => { clearTimeout(mid); clearTimeout(end); };
  }, [map, state.currentStep]);

  return null;
}

/**
 * Step 6: dark overlay covering the entire map with a transparent hole punched out
 * over the active field, so only that field is visible through the grey wash.
 */
function FieldFocusMask() {
  const { state } = useOnboarding();

  if (state.currentStep !== 6 || !state.activeFieldId) return null;

  const field = (state.detectedFields?.features ?? []).find(f => f.id === state.activeFieldId);
  if (!field) return null;

  const fieldRing = field.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
  const worldRing: [number, number][] = [[-90, -180], [-90, 180], [90, 180], [90, -180]];

  return (
    <Polygon
      positions={[worldRing, fieldRing]}
      pathOptions={{
        stroke: false,
        fillColor: '#111827',
        fillOpacity: 0.65,
        // evenodd fill rule makes the inner ring a transparent hole
        fillRule: 'evenodd',
      }}
    />
  );
}

/** Step-specific map overlays, driven by currentStep */
function MapContent() {
  const { state, dispatch } = useOnboarding();
  const step = state.currentStep;

  const fields = state.detectedFields?.features ?? [];
  const selectedFields = fields.filter((f) => state.selectedFieldIds.has(f.id));

  function handleToggle(id: string) {
    dispatch({ type: 'TOGGLE_FIELD', payload: id });
  }

  return (
    <>
      <InvalidateSizeOnStep />
      <MaxBoundsController />

      {step === 2 && state.coordinates && (
        <FlyToHandler lat={state.coordinates.lat} lng={state.coordinates.lng} />
      )}

      {step === 3 && <DetectionController />}

      {step === 4 && (
        <FieldOverlay
          features={fields}
          selectedIds={state.selectedFieldIds}
          onToggle={handleToggle}
        />
      )}

      {step === 5 && (
        <>
          <FitBounds features={selectedFields} />
          <FieldOverlay
            features={selectedFields}
            selectedIds={state.selectedFieldIds}
          />
        </>
      )}

      {step === 6 && (
        <>
          <FlyToActiveField />
          <FieldFocusMask />
          {/* Only render the active field — it sits above the mask */}
          {selectedFields
            .filter(f => f.id === state.activeFieldId)
            .map(f => (
              <FieldPolygon key={f.id} feature={f} selected active permanentLabel />
            ))
          }
        </>
      )}
    </>
  );
}

export default function OnboardingMap() {
  return (
    <SatelliteMap center={[54.5, -3]} zoom={6}>
      <MapContent />
    </SatelliteMap>
  );
}
