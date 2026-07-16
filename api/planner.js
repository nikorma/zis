/**
 * /api/planner — Genera un itinerario di viaggio per QUALSIASI destinazione.
 * Stessa chiave e stesse protezioni di /api/ai (OPENAI_API_KEY).
 * Riceve i parametri strutturati e restituisce JSON rigido:
 *   { days: [ { date, title, stops: [ { title, time, durationMinutes, description, address? } ] } ] }
 */

const hourly = new Map();
const MAX_PER_HOUR = 10; // generare un itinerario costa più di una domanda

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Backend non configurato: manca OPENAI_API_KEY' });

  const ip = (req.headers['x-forwarded-for'] || 'unknown').toString().split(',')[0].trim();
  const now = Date.now();
  const slot = hourly.get(ip);
  if (!slot || now > slot.resetTs) hourly.set(ip, { count: 1, resetTs: now + 3600_000 });
  else if (slot.count >= MAX_PER_HOUR) return res.status(429).json({ error: 'Troppi itinerari generati in quest\u2019ora: riprova più tardi.' });
  else slot.count += 1;

  const {
    destination, startDate, endDate, checkinTime, checkoutTime,
    afternoonBreak, lunchOut, dinnerOut, notes,
  } = req.body || {};
  if (!destination || !startDate || !endDate) {
    return res.status(400).json({ error: 'Servono destinazione e date.' });
  }

  const system = `Sei un travel planner esperto. Rispondi ESCLUSIVAMENTE con JSON valido, senza testo attorno, senza markdown.
Schema: {"days":[{"date":"YYYY-MM-DD","title":"...","stops":[{"title":"...","time":"HH:MM","durationMinutes":60,"description":"1-2 frasi utili","address":"via o zona (se nota)"}]}]}
Regole:
- Una voce in "days" per OGNI giorno dal check-in al check-out inclusi.
- Il primo giorno inizia DOPO l'orario di check-in; l'ultimo finisce PRIMA del check-out.
- ${afternoonBreak ? 'Inserisci ogni giorno una pausa/riposo tra le 14 e le 17 (tappa "Pausa pomeridiana").' : 'Giornate continue, SENZA pausa pomeridiana.'}
- ${lunchOut ? 'Includi ogni giorno una tappa pranzo in zona (indica il tipo di locale, non inventare nomi se non sei certo).' : 'NON pianificare pranzi fuori.'}
- ${dinnerOut ? 'Includi ogni giorno una tappa cena.' : 'NON pianificare cene fuori.'}
- Tappe realistiche e vicine tra loro, ordine geografico sensato, 4-7 tappe al giorno.
- NON inventare prezzi né orari di apertura: se un luogo richiede biglietto scrivi in description "biglietto: verificare sul sito ufficiale".
- Lingua: italiano.`;

  const user = `Destinazione: ${destination}
Periodo: dal ${startDate} (check-in ore ${checkinTime || '15:00'}) al ${endDate} (check-out ore ${checkoutTime || '10:00'})
${notes ? 'Preferenze extra: ' + notes : ''}`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 3500,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: 'Errore del fornitore AI', detail: detail.slice(0, 200) });
    }
    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    let plan;
    try { plan = JSON.parse(raw); } catch { return res.status(502).json({ error: 'Risposta AI non in formato valido: riprova.' }); }
    if (!Array.isArray(plan.days)) return res.status(502).json({ error: 'Itinerario vuoto: riprova.' });
    return res.status(200).json({ days: plan.days, tokens: data.usage?.total_tokens ?? 0 });
  } catch {
    return res.status(500).json({ error: 'Errore interno del planner' });
  }
}
