import { Link } from 'react-router-dom';
import { useApp } from '../state/AppStore';

export default function PrivacyPage() {
  const { data, update } = useApp();
  const s = data.settings;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <h1 className="page-title">Privacy e dati</h1>
      <div className="azulejo-band" aria-hidden />

      <section className="card space-y-2 text-sm leading-relaxed">
        <h2 className="font-display text-lg">Come tratta i dati questa app</h2>
        <p><strong>Dove vivono i tuoi dati.</strong> Itinerario, biglietti, preferiti, impostazioni e audio scaricati sono salvati <em>solo su questo dispositivo</em> (localStorage e IndexedDB del browser). Non esiste un account e nessun dato personale viene inviato a server dell\u2019app.</p>
        <p><strong>Posizione GPS.</strong> Usata esclusivamente sul dispositivo per calcolare distanze e avvisarti all\u2019arrivo. Non viene mai trasmessa né registrata. Si attiva solo dopo il tuo consenso esplicito e puoi disattivarla in ogni momento dalla Home. Nota: i browser sospendono il GPS in background o a schermo spento.</p>
        <p><strong>Assistente "Chiedi alla guida".</strong> Le domande che digiti vengono inviate al backend dell\u2019app e da lì al fornitore AI per generare la risposta; insieme alla domanda non viene inviata la tua posizione né altri dati personali. Le risposte vengono salvate in locale per l\u2019uso offline.</p>
        <p><strong>Mappe.</strong> Le mappe caricano tessere da OpenStreetMap: come per qualunque sito, il fornitore delle mappe vede le richieste di rete (indirizzo IP e zone della mappa richieste).</p>
        <p><strong>Meteo e clima.</strong> Per la Valigia intelligente il clima della destinazione viene richiesto a Open-Meteo usando il nome della città che scrivi (mai la tua posizione).</p>
        <p><strong>Nessuna pubblicità, nessun tracciamento.</strong> L\u2019app non contiene analytics, cookie di profilazione o SDK di terze parti.</p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-lg">I tuoi consensi</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.geoConsent} onChange={(e) => update({ settings: { ...s, geoConsent: e.target.checked } })} />
          Geolocalizzazione (avvisi di arrivo, distanze)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.notificationsConsent} onChange={(e) => {
            if (e.target.checked && 'Notification' in window) {
              Notification.requestPermission().then((p) => update({ settings: { ...s, notificationsConsent: p === 'granted' } }));
            } else update({ settings: { ...s, notificationsConsent: false } });
          }} />
          Notifiche
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.autoplayConsentGiven} onChange={(e) => update({ settings: { ...s, autoplayConsentGiven: e.target.checked, autoplayAudio: e.target.checked } })} />
          Avvio automatico dell\u2019audio all\u2019arrivo
        </label>
      </section>

      <section className="card space-y-2">
        <h2 className="font-display text-lg">Controllo dei dati</h2>
        <p className="text-sm opacity-80">Puoi esportare, importare o eliminare tutti i dati in ogni momento dalle <Link className="underline" to="/impostazioni">Impostazioni</Link>. L\u2019eliminazione è immediata e definitiva perché i dati esistono solo qui.</p>
      </section>
    </div>
  );
}
