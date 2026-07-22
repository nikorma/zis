/**
 * /api/planner — Genera un itinerario di viaggio per QUALSIASI destinazione.
 * Stessa chiave e stesse protezioni di /api/ai (OPENAI_API_KEY).
 * Riceve i parametri strutturati e restituisce JSON rigido:
 *   { days: [ { date, title, stops: [ { title, time, durationMinutes, description, address? } ] } ] }
 */

const hourly = new Map();
const MAX_PER_HOUR = 10; // generare un itinerario costa più di una domanda

export const config = { maxDuration: 60 };

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
  else if (slot.count >= MAX_PER_HOUR) return res.status(429).json({ error: 'Troppi itinerari generati in quest’ora: riprova più tardi.' });
  else slot.count += 1;

  const {
    destination, startDate, endDate, checkinTime, checkoutTime,
    afternoonBreak, lunchOut, dinnerOut, notes, mealTimes, mode, wishlist, timeMode,
    tripStart, tripEnd, partIndex, partTotal, usedPlaces, lang,
  } = req.body || {};
  const LANG_NAMES = { it: 'italiano', en: 'inglese (English)', fr: 'francese (français)', es: 'spagnolo (español)', el: 'greco (ελληνικά)' };
  const langName = LANG_NAMES[lang] || 'italiano';
  const multiPart = partTotal && partTotal > 1;
  const mt = { wake: '07:30', breakfast: '08:00', lunch: '13:00', dinner: '20:30', ...(mealTimes || {}) };
  if (!destination || !startDate || !endDate) {
    return res.status(400).json({ error: 'Servono destinazione e date.' });
  }

  const system = `Sei un travel planner esperto. Rispondi ESCLUSIVAMENTE con JSON valido, senza testo attorno, senza markdown.
Schema: {"days":[{"date":"YYYY-MM-DD","title":"...","stops":[{"title":"...","time":"HH:MM","durationMinutes":60,"description":"2-3 frasi ricche e interessanti (storia/cosa vedere)","address":"via o zona (se nota)","paid":true|false,"officialSite":"URL ufficiale SOLO se ne sei certo, altrimenti null"}]}],"warnings":["eventuali avvisi per l'utente"]}
Regole:
- Una voce in "days" per OGNI giorno dal check-in al check-out inclusi.
- Il primo giorno inizia DOPO l'orario di check-in; l'ultimo finisce PRIMA del check-out.
- ${afternoonBreak ? 'Inserisci ogni giorno una pausa/riposo tra le 14 e le 17 (tappa "Pausa pomeridiana").' : 'Giornate continue, SENZA pausa pomeridiana.'}
${timeMode === 'ordine' ? `- MODALITÀ ORDINE DI VISITA: NON assegnare orari — ometti del tutto il campo "time" (o mettilo null). Ordina le tappe nella sequenza di visita migliore (geografica); pranzo e cena vanno nella posizione giusta della sequenza, senza orario.` : `- ORARI DELL'UTENTE (rispettali con precisione): sveglia ${mt.wake}, colazione ${mt.breakfast}, pranzo ${mt.lunch}, cena ${mt.dinner}.
- La prima tappa di ogni giornata inizia circa 45 minuti dopo la colazione (mai prima).`}
- ${lunchOut ? `Includi ogni giorno una tappa PRANZO alle ${mt.lunch} in punto (indica il tipo di locale, non inventare nomi se non sei certo).` : 'NON pianificare pranzi fuori, ma lascia libera la fascia del pranzo.'}
- ${dinnerOut ? `Includi ogni giorno una tappa CENA alle ${mt.dinner} in punto.` : 'NON pianificare cene fuori.'}
${mode === 'manuale' && wishlist ? `- L'UTENTE HA SCELTO LUI cosa vedere. Usa ESATTAMENTE questi luoghi come tappe (tutti, senza aggiungerne altri di visita):
${wishlist}
  Distribuiscili tra i giorni e ORDINALI PER VICINANZA GEOGRAFICA (percorsi sensati, meno spostamenti possibili). Aggiungi solo pasti/pause secondo le regole sopra.` : '- Tappe realistiche e vicine tra loro, ordine geografico sensato, 4-7 tappe al giorno.'}
- "paid": true se serve un biglietto d'ingresso, false se gratuito; NON inventare mai prezzi od orari.
- "officialSite": SOLO il dominio ufficiale se ne sei assolutamente certo (es. museo molto famoso); in dubbio metti null.
- ⚠️ REGOLA ANTI-INVENZIONE (fondamentale): se NON conosci con certezza un luogo, NON inventare MAI storia, collezioni o dettagli. In quel caso la description deve essere onesta: "Non ho informazioni verificate su questo luogo: controlla il nome." e aggiungi un avviso in "warnings".
- Se un nome scritto dall'utente sembra un errore di battitura di un luogo famoso (es. "due tiri" → "Due Torri", "coloseo" → "Colosseo"), NON inventare: usa il luogo corretto come tappa e segnala in "warnings" (es. "Ho interpretato 'due tiri' come 'Due Torri di Bologna': dimmi se intendevi altro."). Se non riesci a interpretarlo, mettilo come tappa con la description onesta e chiedi chiarimento in "warnings".
- "warnings" è un array di stringhe brevi in italiano; se non ce ne sono, metti [].
- NON RIPETERE MAI la stessa attrazione o lo stesso luogo in giorni diversi dell'itinerario.
- Meglio una descrizione breve e CERTA che una lunga e inventata: se di un luogo sai poco, di' solo ciò di cui sei sicuro.
- Lingua di TUTTI i testi (title, description, warnings): ${langName}. Se citi l'app, chiamala \"ZainoInSpalla\".`;

  const user = `Destinazione: ${destination}
${multiPart
  ? `Questo è il BLOCCO ${partIndex}/${partTotal} di un viaggio lungo (dal ${tripStart} al ${tripEnd}). Genera SOLO i giorni dal ${startDate} al ${endDate}, compresi.
${startDate === tripStart ? `Il ${tripStart} c'è l'arrivo: prima tappa dopo il check-in delle ${checkinTime || '15:00'}.` : ''}
${endDate === tripEnd ? `Il ${tripEnd} c'è la partenza: check-out ore ${checkoutTime || '10:00'}, solo attività leggere prima.` : ''}
${Array.isArray(usedPlaces) && usedPlaces.length ? `NON RIPETERE questi luoghi già programmati nei blocchi precedenti: ${usedPlaces.join('; ')}.` : ''}
Varia i quartieri e il ritmo rispetto ai blocchi precedenti; per soggiorni lunghi inserisci anche giornate più rilassate o gite nei dintorni.`
  : `Periodo: dal ${startDate} (check-in ore ${checkinTime || '15:00'}) al ${endDate} (check-out ore ${checkoutTime || '10:00'})`}
${notes ? 'Preferenze extra: ' + notes : ''}`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        max_tokens: 4000,
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
