import { useEffect, useState } from 'react';

const LS_DISMISS = 'zaino-install-dismissed';

/** True se l'app è già aperta come app installata (schermata Home). */
function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const nativeShell = window.location.protocol === 'capacitor:' || window.location.protocol === 'file:';
  return Boolean(standalone || iosStandalone || nativeShell);
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Invito ad aggiungere l'app alla schermata Home.
 * - Android/Chrome: usa il vero invito del sistema (un tocco e si installa).
 * - iPhone: il sistema non lo permette, quindi mostra le istruzioni (Condividi → Aggiungi a Home).
 * Non compare se l'app è già installata o se l'utente ha detto "no grazie".
 */
export default function InstallPrompt() {
  const [evt, setEvt] = useState<{ prompt: () => void; userChoice: Promise<unknown> } | null>(null);
  const [show, setShow] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (isInstalled()) return;
    try { if (localStorage.getItem(LS_DISMISS) === '1') return; } catch { /* ok */ }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as unknown as { prompt: () => void; userChoice: Promise<unknown> });
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iPhone non manda l'evento: mostriamo comunque l'invito con le istruzioni,
    // dopo qualche secondo per non disturbare all'apertura.
    let t: number | undefined;
    if (isIOS()) t = window.setTimeout(() => setShow(true), 4000);

    const onInstalled = () => setShow(false);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(LS_DISMISS, '1'); } catch { /* ok */ }
    setShow(false);
  };

  const install = async () => {
    if (evt) {
      evt.prompt();
      try { await evt.userChoice; } catch { /* ok */ }
      setShow(false);
    } else {
      setIosHelp(true);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed left-3 right-3 bottom-[76px] z-[1500] card border-2 border-oro shadow-xl space-y-2 anim-rise">
      <div className="flex items-start gap-3">
        <img src="./icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1">
          <p className="font-display font-bold">Installa Zaino in Spalla</p>
          <p className="text-xs opacity-70">
            Aggiungila alla schermata Home: si apre a tutto schermo e funziona anche offline.
          </p>
        </div>
      </div>

      {iosHelp && (
        <p className="text-xs bg-crema dark:bg-[#141C33] rounded-xl p-2">
          Su iPhone: tocca <strong>Condividi</strong> ⬆️ nella barra di Safari, poi <strong>«Aggiungi a Home»</strong>.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost !min-h-[40px] !py-1 text-sm" onClick={dismiss}>Non ora</button>
        <button className="btn-gold !min-h-[40px] !py-1 text-sm" onClick={install}>
          {evt ? '📲 Installa' : 'ℹ️ Come si fa'}
        </button>
      </div>
    </div>
  );
}
