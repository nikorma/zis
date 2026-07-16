import type { TicketState } from '../types';

/**
 * Il biglietto NON viene mai marcato "acquistato" automaticamente:
 * solo l'azione esplicita dell'utente cambia lo stato.
 */
export function ensureTicket(
  tickets: Record<string, TicketState>,
  placeId: string
): Record<string, TicketState> {
  if (tickets[placeId]) return tickets;
  return { ...tickets, [placeId]: { placeId, status: 'da-acquistare' } };
}

export function markPurchased(
  tickets: Record<string, TicketState>,
  placeId: string,
  info?: Partial<Pick<TicketState, 'purchaseDate' | 'timeSlot' | 'bookingCode' | 'notes'>>
): Record<string, TicketState> {
  const prev = tickets[placeId] ?? { placeId, status: 'da-acquistare' as const };
  return {
    ...tickets,
    [placeId]: {
      ...prev,
      ...info,
      status: 'acquistato',
      purchaseDate: info?.purchaseDate ?? prev.purchaseDate ?? new Date().toISOString().slice(0, 10),
    },
  };
}

export function markNotPurchased(
  tickets: Record<string, TicketState>,
  placeId: string
): Record<string, TicketState> {
  const prev = tickets[placeId];
  if (!prev) return tickets;
  return { ...tickets, [placeId]: { ...prev, status: 'da-acquistare' } };
}

export function updateTicket(
  tickets: Record<string, TicketState>,
  placeId: string,
  patch: Partial<TicketState>
): Record<string, TicketState> {
  const prev = tickets[placeId] ?? { placeId, status: 'da-acquistare' as const };
  // Lo stato non può essere cambiato tramite patch generica: serve l'azione esplicita.
  const { status: _ignored, ...safe } = patch;
  return { ...tickets, [placeId]: { ...prev, ...safe } };
}
