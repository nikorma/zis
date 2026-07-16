import { describe, it, expect } from 'vitest';
import * as itin from './itinerary';
import { ensureTicket, markPurchased, markNotPurchased, updateTicket } from './tickets';
import { emptyData, exportJson, importJson, resolveConflict } from './storage';
import type { Day } from '../types';

function demoDays(): Day[] {
  let days: Day[] = [];
  days = itin.addDay(days, '2026-08-06', 'Giorno 2');
  days = itin.addDay(days, '2026-08-05', 'Giorno 1');
  return days;
}

describe('itinerario: giornate', () => {
  it('aggiunge e ordina le giornate per data', () => {
    const days = demoDays();
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe('2026-08-05');
    expect(days[1].date).toBe('2026-08-06');
  });
  it('aggiorna titolo e data (riordinando)', () => {
    let days = demoDays();
    days = itin.updateDay(days, days[0].id, { date: '2026-08-07', title: 'Spostato' });
    expect(days[1].title).toBe('Spostato');
    expect(days[1].date).toBe('2026-08-07');
  });
  it('rimuove una giornata', () => {
    let days = demoDays();
    const id = days[0].id;
    days = itin.removeDay(days, id);
    expect(days).toHaveLength(1);
    expect(days.find((d) => d.id === id)).toBeUndefined();
  });
});

describe('itinerario: tappe', () => {
  it('aggiunge, aggiorna e rimuove una tappa', () => {
    let days = demoDays();
    const dayId = days[0].id;
    days = itin.addStop(days, dayId, { title: 'Museo', time: '09:30' });
    expect(days[0].stops).toHaveLength(1);
    const stopId = days[0].stops[0].id;
    days = itin.updateStop(days, dayId, stopId, { time: '10:00', notes: 'prenotato' });
    expect(days[0].stops[0].time).toBe('10:00');
    expect(days[0].stops[0].notes).toBe('prenotato');
    days = itin.removeStop(days, dayId, stopId);
    expect(days[0].stops).toHaveLength(0);
  });

  it('riordina le tappe con moveStop, ignorando indici fuori range', () => {
    let days = demoDays();
    const dayId = days[0].id;
    days = itin.addStop(days, dayId, { title: 'A' });
    days = itin.addStop(days, dayId, { title: 'B' });
    days = itin.addStop(days, dayId, { title: 'C' });
    days = itin.moveStop(days, dayId, 0, 2);
    expect(days[0].stops.map((s) => s.title)).toEqual(['B', 'C', 'A']);
    // fuori range: nessun cambiamento e nessun errore
    const before = days[0].stops.map((s) => s.title);
    days = itin.moveStop(days, dayId, 5, 0);
    days = itin.moveStop(days, dayId, 0, -1);
    expect(days[0].stops.map((s) => s.title)).toEqual(before);
  });

  it('toggleVisited alterna lo stato', () => {
    let days = demoDays();
    const dayId = days[0].id;
    days = itin.addStop(days, dayId, { title: 'A' });
    const sid = days[0].stops[0].id;
    days = itin.toggleVisited(days, dayId, sid);
    expect(days[0].stops[0].visited).toBe(true);
    days = itin.toggleVisited(days, dayId, sid);
    expect(days[0].stops[0].visited).toBe(false);
  });

  it('nextStop restituisce la prima non visitata', () => {
    let days = demoDays();
    const dayId = days[0].id;
    days = itin.addStop(days, dayId, { title: 'A' });
    days = itin.addStop(days, dayId, { title: 'B' });
    days = itin.toggleVisited(days, dayId, days[0].stops[0].id);
    expect(itin.nextStop(days[0])?.title).toBe('B');
  });
});

describe('biglietti: mai marcati automaticamente', () => {
  it('ensureTicket crea con stato "da_acquistare"', () => {
    const t = ensureTicket({}, 'museo');
    expect(t.museo.status).toBe('da-acquistare');
  });

  it('updateTicket NON può cambiare lo stato (protezione anti-automatismo)', () => {
    let t = ensureTicket({}, 'museo');
    // Tentativo di cambiare status tramite patch generica: deve essere ignorato
    t = updateTicket(t, 'museo', { status: 'acquistato', notes: 'x' } as never);
    expect(t.museo.status).toBe('da-acquistare');
    expect(t.museo.notes).toBe('x');
  });

  it('solo markPurchased (azione esplicita) segna come acquistato, con dettagli', () => {
    let t = ensureTicket({}, 'museo');
    t = markPurchased(t, 'museo', { purchaseDate: '2026-07-20', timeSlot: '09:30', bookingCode: 'ABC123' });
    expect(t.museo.status).toBe('acquistato');
    expect(t.museo.timeSlot).toBe('09:30');
    t = markNotPurchased(t, 'museo');
    expect(t.museo.status).toBe('da-acquistare');
    // I dettagli restano per riferimento
    expect(t.museo.bookingCode).toBe('ABC123');
  });
});

describe('storage: export/import JSON', () => {
  it('roundtrip senza perdita', () => {
    const data = emptyData();
    data.days = itin.addDay([], '2026-08-05', 'Test');
    data.favorites = ['museo'];
    data.tickets = markPurchased(ensureTicket({}, 'museo'), 'museo', { timeSlot: '09:30' });
    const json = exportJson(data);
    const res = importJson(json);
    if (!res.ok) throw new Error('import fallito');
    expect(res.data.days[0].title).toBe('Test');
    expect(res.data.favorites).toContain('museo');
    expect(res.data.tickets.museo.status).toBe('acquistato');
  });

  it('rifiuta JSON non valido con errore in italiano', () => {
    const res = importJson('{non json');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/JSON valido/i);
  });
  it('rifiuta backup di altre app', () => {
    const res = importJson(JSON.stringify({ hello: 'world' }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/itinerario/i);
  });

  it('importa con campi mancanti applicando i default (migrazione)', () => {
    const min = JSON.stringify({ version: 1, days: [] });
    const res = importJson(min);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.settings.arrivalRadiusMeters).toBeGreaterThanOrEqual(40);
      expect(res.data.favorites).toEqual([]);
    }
  });
});

describe('storage: risoluzione conflitti (sync manuale)', () => {
  it('mantiene per ogni giornata la versione più completa (visited vince)', () => {
    const a = emptyData();
    a.days = itin.addDay([], '2026-08-05', 'Giorno');
    a.days = itin.addStop(a.days, a.days[0].id, { title: 'X' });

    const b: typeof a = JSON.parse(JSON.stringify(a));
    b.days = itin.toggleVisited(b.days, b.days[0].id, b.days[0].stops[0].id);

    const merged = resolveConflict(a, b);
    expect(merged.days[0].stops[0].visited).toBe(true);
  });

  it('un biglietto acquistato non viene mai retrocesso dall\u2019unione', () => {
    const a = emptyData();
    a.tickets = ensureTicket({}, 'museo'); // da_acquistare
    const b = emptyData();
    b.tickets = markPurchased(ensureTicket({}, 'museo'), 'museo', {});
    expect(resolveConflict(a, b).tickets.museo.status).toBe('acquistato');
    expect(resolveConflict(b, a).tickets.museo.status).toBe('acquistato');
  });

  it('unisce preferiti e audio scaricati senza duplicati', () => {
    const a = emptyData(); a.favorites = ['museo']; a.downloadedAudio = ['k1'];
    const b = emptyData(); b.favorites = ['museo', 'parco']; b.downloadedAudio = ['k1', 'k2'];
    const m = resolveConflict(a, b);
    expect(m.favorites.sort()).toEqual(['museo', 'parco']);
    expect(m.downloadedAudio.sort()).toEqual(['k1', 'k2']);
  });
});
