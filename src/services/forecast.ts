import type { LatLng } from '../types';

/**
 * Previsioni meteo per LA TAPPA: temperatura e pioggia all'ORA e nel LUOGO
 * della tappa (Open-Meteo, gratuito, senza chiave).
 * - Mostrate solo se la data è entro 7 giorni (oltre non sono affidabili).
 * - Cache di 30 minuti: si aggiornano da sole, sempre fresche.
 */

export interface HourForecast {
  temp: number;
  precipProb: number; // %
  emoji: string;
}

const cache = new Map<string, { ts: number; hours: { t: number[]; p: number[]; c: number[] } }>();
const TTL = 30 * 60 * 1000;

export function forecastAvailable(dateIso: string): boolean {
  const d = new Date(dateIso + 'T12:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - today.getTime()) / 86400000;
  return diff >= 0 && diff <= 7;
}

function codeEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

export async function hourForecast(coords: LatLng, dateIso: string, time?: string): Promise<HourForecast | null> {
  if (!forecastAvailable(dateIso)) return null;
  const key = `${coords.lat.toFixed(2)},${coords.lng.toFixed(2)},${dateIso}`;
  const hit = cache.get(key);
  let hours = hit && Date.now() - hit.ts < TTL ? hit.hours : null;
  if (!hours) {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}` +
        `&hourly=temperature_2m,precipitation_probability,weather_code` +
        `&start_date=${dateIso}&end_date=${dateIso}&timezone=auto`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const j = await r.json();
      hours = {
        t: j?.hourly?.temperature_2m ?? [],
        p: j?.hourly?.precipitation_probability ?? [],
        c: j?.hourly?.weather_code ?? [],
      };
      if (!hours.t.length) return null;
      cache.set(key, { ts: Date.now(), hours });
    } catch {
      return null;
    }
  }
  const h = Math.min(23, Math.max(0, time ? parseInt(time.slice(0, 2), 10) : 12));
  const temp = hours.t[h];
  if (temp === undefined || temp === null) return null;
  return {
    temp: Math.round(temp),
    precipProb: Math.round(hours.p[h] ?? 0),
    emoji: codeEmoji(hours.c[h] ?? 0),
  };
}
