import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData } from '../types';
import { emptyData, loadData, saveData } from '../lib/storage';

interface Store {
  data: AppData;
  update: (patch: Partial<AppData>) => void;
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
      update: (patch) => setData((d) => ({ ...d, ...patch })),
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
