# Zaino in Spalla 🎒

PWA installabile: **il tuo compagno di viaggio** per qualsiasi destinazione.

## Funzionalità

| Area | Cosa fa |
|---|---|
| **🌍 Pianifica un viaggio** | Dai destinazione, date e orari di check-in/check-out; l'app chiede se vuoi la pausa pomeridiana e se pranzi/ceni fuori, poi genera l'itinerario completo (AI). Salvi, condividi su WhatsApp o invii al Gruppo |
| **🗓️ Itinerario** | CRUD completo di giornate e tappe, riordino drag & drop, ricerca luoghi stile Google Maps (mondiale, senza chiavi), salvataggio automatico |
| **🗺️ Mappe** | OpenStreetMap/Leaflet, percorso della giornata, distanze e tempi a piedi/bici, "Portami qui" verso Google Maps |
| **📡 GPS** | Solo su consenso; avviso di arrivo UNA volta per destinazione (vibrazione + notifica + voce), raggio 40–100 m, gestione permessi/precisione |
| **🧳 Valigia intelligente** | Chiede genere, taglie, tipo di bagaglio e mezzo (aereo/auto/treno/nave/combinato); stima il clima della destinazione (Open-Meteo, storico stesse date) e calcola capi e quantità, con checklist e condivisione |
| **👥 Gruppo di viaggio** | Itinerario condiviso in tempo reale via codice invito; ogni tappa appartiene a chi la crea, gli altri inviano richieste di modifica/cancellazione che solo il proprietario approva; presentazione + audioguida + foto automatiche per ogni tappa |
| **💬 Chiedi alla guida** | Assistente AI di viaggio (backend protetto, chiave mai nel client), cache offline, limiti di costo |
| **🎧 Audio** | Voce naturale via /api/tts, download offline in IndexedDB, o voce del dispositivo (sempre disponibile) |
| **📴 Offline** | Service worker: app, mappe viste e foto restano disponibili senza rete |
| **🔒 Dati** | Solo sul dispositivo; export/import JSON; nessun account, nessun tracciamento |

## Avvio

```bash
npm install
npm run dev        # sviluppo
npm run build      # produzione in dist/
npm run test       # test unitari (vitest)
```

## Chiavi API (facoltative, in Vercel → Environment Variables)

| Variabile | Serve per |
|---|---|
| `OPENAI_API_KEY` | Planner AI + assistente (`api/planner.js`, `api/ai.js`) |
| `AI_MAX_REQUESTS_PER_HOUR`, `AI_DAILY_TOKEN_LIMIT` | Limiti di costo |
| `ELEVENLABS_API_KEY` (+ `ELEVENLABS_VOICE_F/_M`) | Voce naturale (`api/tts.js`) |

Senza chiavi l'app funziona al 100% con la voce del dispositivo; planner e assistente mostrano come attivarli.

## Pubblicazione

Vercel consigliato (HTTPS obbligatorio per GPS/PWA): collega il repo GitHub, deploy automatico a ogni commit. Le funzioni in `api/` diventano `/api/ai`, `/api/tts`, `/api/planner`.

Installazione sul telefono: apri l'URL → menu del browser → "Aggiungi a schermata Home".

## Credenziali demo

Pannello admin: password `zaino-dev-2026` (solo dimostrativa, lato client: in produzione spostare la verifica sul backend).

## 👥 Gruppo di viaggio: attivazione Firebase (una volta, ~5 min)

Segui i 5 passi in `src/firebaseConfig.ts` (crea progetto → incolla config → abilita accesso Anonimo → crea Firestore → incolla le regole → Pubblica):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /groups/{groupId} {
      allow read, create: if request.auth != null;
      allow update, delete: if request.auth != null && resource.data.createdBy == request.auth.uid;

      match /stops/{stopId} {
        allow read, create: if request.auth != null;
        allow update, delete: if request.auth != null && resource.data.ownerId == request.auth.uid;
      }
      match /requests/{reqId} {
        allow read, create: if request.auth != null;
        allow update: if request.auth != null && resource.data.ownerId == request.auth.uid;
      }
      match /members/{uid} {
        allow read, create: if request.auth != null;
        allow write: if request.auth != null && uid == request.auth.uid;
      }
      match /expenses/{eid} {
        allow read, create: if request.auth != null;
        allow update, delete: if request.auth != null && resource.data.payerId == request.auth.uid;
      }
    }
  }
}
```

> ⚠️ Se avevi già pubblicato le regole PRIMA della nota spese: torna su Firebase → Firestore → Regole, incolla il blocco aggiornato qui sopra e premi **Pubblica**, altrimenti spese e partecipanti verranno rifiutati.

## Non incluso / predisposto

- Sincronizzazione cloud dell'itinerario personale (oggi: export/import JSON + unione conflitti)
- QR/beacon per l'avanzamento automatico nelle visite
- Traduzioni es/en/el (struttura i18n pronta)
