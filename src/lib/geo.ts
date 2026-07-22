import type { LatLng } from '../types';

const R = 6371000; // raggio terrestre in metri

/** Distanza haversine in metri tra due coordinate. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Formatta la distanza in modo leggibile. */
export function formatDistance(m: number): string {
  if (!isFinite(m)) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** Stime di percorrenza: piedi ~4.7 km/h, bici ~12 km/h (percorso reale ≈ distanza aerea ×1.3). */
export function walkMinutes(m: number): number {
  return Math.max(1, Math.round(((m * 1.3) / 1000 / 4.7) * 60));
}
export function bikeMinutes(m: number): number {
  return Math.max(1, Math.round(((m * 1.3) / 1000 / 12) * 60));
}

/** Trova la destinazione più vicina alla posizione. */
export function nearestTarget<T extends { coords?: LatLng }>(
  pos: LatLng,
  targets: T[]
): { target: T; distance: number } | null {
  let best: { target: T; distance: number } | null = null;
  for (const t of targets) {
    if (!t.coords) continue;
    const d = distanceMeters(pos, t.coords);
    if (!best || d < best.distance) best = { target: t, distance: d };
  }
  return best;
}

/**
 * Rilevatore di arrivo con avviso "una sola volta".
 * - scatta quando la distanza scende sotto il raggio configurato;
 * - richiede una precisione GPS accettabile (accuracy <= raggio*1.5, max 120 m);
 * - non riscatta finché non ci si allontana oltre raggio*2 (isteresi) o si cambia destinazione.
 */
export class ArrivalDetector {
  private announced = new Set<string>();
  private radius: number;

  constructor(radiusMeters = 60) {
    this.radius = clampRadius(radiusMeters);
  }

  setRadius(r: number) {
    this.radius = clampRadius(r);
  }

  /** Reimposta l'avviso per una destinazione (pulsante "Ripeti avviso"). */
  reset(targetId?: string) {
    if (targetId) this.announced.delete(targetId);
    else this.announced.clear();
  }

  /**
   * @returns 'arrived' se bisogna annunciare ORA (solo la prima volta),
   *          'inside' se già annunciato, 'outside' altrimenti,
   *          'low-accuracy' se il fix non è affidabile.
   */
  update(targetId: string, pos: LatLng, target: LatLng, accuracy = 0):
    'arrived' | 'inside' | 'outside' | 'low-accuracy' {
    const d = distanceMeters(pos, target);
    const maxAcc = Math.min(Math.max(this.radius * 1.5, 60), 120);
    if (accuracy > maxAcc) return 'low-accuracy';
    if (d <= this.radius) {
      if (this.announced.has(targetId)) return 'inside';
      this.announced.add(targetId);
      return 'arrived';
    }
    // isteresi: se ci si allontana molto, si potrà riannunciare al ritorno
    if (d > this.radius * 2) this.announced.delete(targetId);
    return 'outside';
  }
}

export function clampRadius(r: number): number {
  if (!isFinite(r)) return 60;
  return Math.min(100, Math.max(40, Math.round(r)));
}

export type TravelMode = 'walking' | 'driving' | 'transit' | 'bicycling';

/** Link Google Maps "Portami qui" (default: a piedi, modalità cambiabile). */
export function googleMapsDirectionsUrl(dest: LatLng, origin?: LatLng, mode: TravelMode = 'walking'): string {
  const d = `${dest.lat},${dest.lng}`;
  const o = origin ? `&origin=${origin.lat},${origin.lng}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${d}${o}&travelmode=${mode}`;
}
