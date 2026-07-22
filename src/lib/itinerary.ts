import type { Day, Stop } from '../types';

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Rimuove giornate con data doppia e tappe doppie (stesso titolo+ora) nello stesso giorno. */
export function dedupeDays(days: Day[]): Day[] {
  const byDate = new Map<string, Day>();
  for (const d of days) {
    const ex = byDate.get(d.date);
    if (!ex) {
      const seen = new Set<string>();
      byDate.set(d.date, { ...d, stops: d.stops.filter((st) => {
        const k = `${st.title}|${st.time ?? ''}`; if (seen.has(k)) return false; seen.add(k); return true;
      }) });
    } else {
      for (const st of d.stops) {
        const k = `${st.title}|${st.time ?? ''}`;
        if (!ex.stops.some((e) => `${e.title}|${e.time ?? ''}` === k)) ex.stops.push(st);
      }
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function addDay(days: Day[], date: string, title: string): Day[] {
  const day: Day = { id: uid('day'), date, title, stops: [] };
  return [...days, day].sort((a, b) => a.date.localeCompare(b.date));
}

export function removeDay(days: Day[], dayId: string): Day[] {
  return days.filter((d) => d.id !== dayId);
}

export function updateDay(days: Day[], dayId: string, patch: Partial<Pick<Day, 'title' | 'date'>>): Day[] {
  return days
    .map((d) => (d.id === dayId ? { ...d, ...patch } : d))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Ordina le tappe per orario (quelle senza orario in coda, ordine invariato). */
export function sortStopsByTime(stops: Stop[]): Stop[] {
  const withTime = stops.filter((s) => s.time).sort((a, b) => (a.time as string).localeCompare(b.time as string));
  const noTime = stops.filter((s) => !s.time);
  return [...withTime, ...noTime];
}

export function addStop(days: Day[], dayId: string, stop: Omit<Stop, 'id' | 'visited'>): Day[] {
  // evita doppioni: stessa giornata, stesso titolo e stessa ora
  const dayTarget = days.find((d) => d.id === dayId);
  if (dayTarget && dayTarget.stops.some((s) => s.title === stop.title && (s.time ?? '') === (stop.time ?? ''))) {
    return days;
  }
  const s: Stop = { ...stop, id: uid('stop'), visited: false };
  return days.map((d) => (d.id === dayId ? { ...d, stops: [...d.stops, s] } : d));
}

export function removeStop(days: Day[], dayId: string, stopId: string): Day[] {
  return days.map((d) =>
    d.id === dayId ? { ...d, stops: d.stops.filter((s) => s.id !== stopId) } : d
  );
}

export function updateStop(days: Day[], dayId: string, stopId: string, patch: Partial<Stop>): Day[] {
  return days.map((d) =>
    d.id === dayId
      ? { ...d, stops: d.stops.map((s) => (s.id === stopId ? { ...s, ...patch } : s)) }
      : d
  );
}

/** Sposta una tappa da un indice all'altro (trascinamento o frecce). */
export function moveStop(days: Day[], dayId: string, from: number, to: number): Day[] {
  return days.map((d) => {
    if (d.id !== dayId) return d;
    const stops = [...d.stops];
    if (from < 0 || from >= stops.length) return d;
    const clampedTo = Math.max(0, Math.min(stops.length - 1, to));
    const [item] = stops.splice(from, 1);
    stops.splice(clampedTo, 0, item);
    return { ...d, stops };
  });
}

export function toggleVisited(days: Day[], dayId: string, stopId: string): Day[] {
  return days.map((d) =>
    d.id === dayId
      ? { ...d, stops: d.stops.map((s) => (s.id === stopId ? { ...s, visited: !s.visited } : s)) }
      : d
  );
}

/** Trova il giorno corrispondente a una data (o il primo giorno futuro). */
export function dayForDate(days: Day[], isoDate: string): Day | null {
  return (
    days.find((d) => d.date === isoDate) ??
    days.find((d) => d.date > isoDate) ??
    days[days.length - 1] ??
    null
  );
}

/** Prossima tappa non visitata di un giorno. */
export function nextStop(day: Day | null): Stop | null {
  if (!day) return null;
  return day.stops.find((s) => !s.visited) ?? null;
}

/** Le ore più calde in agosto: sconsigliare percorsi lunghi 14:00–19:00. */
export function isHotHour(hour: number): boolean {
  return hour >= 14 && hour < 19;
}
