import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../types';
import { emptyData, loadData, saveData } from '../lib/storage';

interface Store {
  data: AppData;
  update: (patch: Partial<AppData> | ((d: AppData) => Partial<AppData>)) => void;
  replaceAll: (next: AppData) => void;
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData() ?? emptyData());
  const first = useRef(true);

  // Salvataggio automatico a ogni modifica.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      saveData(data);
      return;
    }
    saveData(data);
  }, [data]);

  const store = useMemo<Store>(
    () => ({
      data,
      update: (patch) => setData((d) => {
        const p = typeof patch === 'function' ? patch(d) : patch;
        const next = { ...d, ...p };
        // Salvataggio automatico: l'itinerario attivo resta sincronizzato col viaggio salvato
        // (ma non quando il patch aggiorna già trips da solo, come fa il sync del gruppo)
        if (p.days && next.activeTripId && !p.trips) {
          next.trips = next.trips.map((t) => (t.id === next.activeTripId ? { ...t, days: p.days as typeof t.days } : t));
        }
        return next;
      }),
      replaceAll: (next) => setData(next),
    }),
    [data]
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useApp(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp deve essere usato dentro AppStoreProvider');
  return ctx;
}
