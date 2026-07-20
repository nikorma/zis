import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng } from '../types';
import { ArrivalDetector } from '../lib/geo';

export type GeoStatus =
  | 'idle'            // GPS non attivato
  | 'requesting'      // in attesa del permesso
  | 'active'          // posizione in aggiornamento
  | 'denied'          // permesso negato
  | 'unavailable'     // GPS non disponibile sul dispositivo
  | 'low-accuracy'    // precisione insufficiente
  | 'stale';          // posizione memorizzata non aggiornata

export interface GeoState {
  status: GeoStatus;
  position: LatLng | null;
  accuracy: number | null;
  lastFixTs: number | null;
  errorMessage: string | null;
}

const STALE_MS = 60_000; // dopo 60 s senza fix, la posizione è considerata vecchia

/**
 * Hook di geolocalizzazione:
 * - si attiva SOLO su richiesta esplicita (consenso);
 * - gestisce permesso negato, GPS assente, bassa precisione, fix vecchi;
 * - espone un ArrivalDetector condiviso per l'avviso "una sola volta".
 * Nota: molti browser SOSPENDONO il GPS quando l'app va in background o lo
 * schermo si spegne; al ritorno il fix può essere vecchio (stato "stale").
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    status: 'idle', position: null, accuracy: null, lastFixTs: null, errorMessage: null,
  });
  const watchId = useRef<number | null>(null);
  const staleTimer = useRef<number | null>(null);
  const detector = useRef(new ArrivalDetector(60));

  const clearStaleTimer = () => {
    if (staleTimer.current !== null) {
      window.clearTimeout(staleTimer.current);
      staleTimer.current = null;
    }
  };

  const stop = useCallback(() => {
    if (watchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
    clearStaleTimer();
    setState((s) => ({ ...s, status: 'idle' }));
  }, []);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, status: 'unavailable', errorMessage: 'Questo dispositivo o browser non offre la geolocalizzazione.' }));
      return;
    }
    setState((s) => ({ ...s, status: 'requesting', errorMessage: null }));
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        clearStaleTimer();
        staleTimer.current = window.setTimeout(() => {
          setState((s) => (s.status === 'active' ? { ...s, status: 'stale' } : s));
        }, STALE_MS);
        const accuracy = pos.coords.accuracy ?? 9999;
        setState({
          status: accuracy > 120 ? 'low-accuracy' : 'active',
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy,
          lastFixTs: Date.now(),
          errorMessage: accuracy > 120 ? `Precisione GPS insufficiente (±${Math.round(accuracy)} m): avvicinati a cielo aperto.` : null,
        });
      },
      (err) => {
        clearStaleTimer();
        if (err.code === err.PERMISSION_DENIED) {
          setState((s) => ({ ...s, status: 'denied', errorMessage: 'Permesso GPS negato. Puoi riattivarlo dalle impostazioni del browser (icona lucchetto accanto all’indirizzo).' }));
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setState((s) => ({ ...s, status: 'unavailable', errorMessage: 'Posizione non disponibile: GPS spento o segnale assente.' }));
        } else {
          setState((s) => ({ ...s, status: 'unavailable', errorMessage: 'Timeout GPS: riprova all’aperto.' }));
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }, []);

  // Al ritorno in foreground, se il fix è vecchio segnala "stale".
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setState((s) => {
          if (s.lastFixTs && Date.now() - s.lastFixTs > STALE_MS && s.status === 'active') {
            return { ...s, status: 'stale' };
          }
          return s;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { ...state, start, stop, detector: detector.current };
}
