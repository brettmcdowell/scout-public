import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Farm } from '../types/geo';
import { fetchLatestFarm } from '../api/onboarding';
import { preCacheField } from '../lib/analysisCache';

interface FarmContextValue {
  farm: Farm | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const [farm, setFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);

    fetchLatestFarm()
      .then((farm) => {
        setFarm(farm);
        farm?.fields.features.forEach(preCacheField);
      })
      .catch(() => setError('Could not load farm data'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <FarmContext.Provider value={{ farm, loading, error, refresh: load }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarm must be used within FarmProvider');
  return ctx;
}
