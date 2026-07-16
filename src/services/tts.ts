import { getAudio, saveAudio } from '../lib/storage';
import type { Settings } from '../types';

/**
 * Tre modalità di audioguida:
 *  1. "natural"  → voce naturale tramite /api/tts (ElevenLabs, chiave solo lato server);
 *  2. "offline"  → file audio già scaricati e salvati in IndexedDB;
 *  3. "webspeech"→ Web Speech API del dispositivo (soluzione di emergenza).
 * Se la modalità scelta non è disponibile si scala automaticamente verso il basso.
 */

export type PlayerState = 'idle' | 'playing' | 'paused' | 'error';

type Listener = (s: PlayerState) => void;

class TtsPlayer {
  private audio: HTMLAudioElement | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private listeners = new Set<Listener>();
  state: PlayerState = 'idle';
  lastError = '';

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private set(s: PlayerState) {
    this.state = s;
    this.listeners.forEach((l) => l(s));
  }

  /** Riproduce un testo secondo le impostazioni. `key` identifica l'audio per la cache offline. */
  async play(text: string, key: string, settings: Settings): Promise<void> {
    this.stop();
    try {
      if (settings.ttsMode === 'offline' || settings.ttsMode === 'natural') {
        const cached = await getAudio(key).catch(() => null);
        if (cached) return this.playBlob(cached, settings);
        if (settings.ttsMode === 'natural' && navigator.onLine) {
          const blob = await this.fetchNatural(text, settings);
          if (blob) {
            await saveAudio(key, blob).catch(() => undefined);
            return this.playBlob(blob, settings);
          }
        }
      }
    } catch (e) {
      this.lastError = String(e);
    }
    // Emergenza: Web Speech API
    this.playWebSpeech(text, settings);
  }

  /** Scarica l'audio naturale per l'uso offline senza riprodurlo. */
  async download(text: string, key: string, settings: Settings): Promise<boolean> {
    try {
      const existing = await getAudio(key).catch(() => null);
      if (existing) return true;
      const blob = await this.fetchNatural(text, settings);
      if (!blob) return false;
      await saveAudio(key, blob);
      return true;
    } catch {
      return false;
    }
  }

  private async fetchNatural(text: string, settings: Settings): Promise<Blob | null> {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: settings.voiceGender, lang: settings.lang }),
      });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null; // endpoint non disponibile (es. sviluppo locale senza backend)
    }
  }

  private playBlob(blob: Blob, settings: Settings) {
    const url = URL.createObjectURL(blob);
    this.audio = new Audio(url);
    this.audio.volume = settings.voiceVolume;
    this.audio.playbackRate = settings.voiceRate;
    this.audio.onended = () => this.set('idle');
    this.audio.onerror = () => this.set('error');
    this.audio.play().then(() => this.set('playing')).catch(() => this.set('error'));
  }

  private playWebSpeech(text: string, settings: Settings) {
    if (!('speechSynthesis' in window)) {
      this.lastError = 'Sintesi vocale non disponibile su questo dispositivo.';
      this.set('error');
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = settings.lang === 'it' ? 'it-IT' : settings.lang === 'es' ? 'es-ES' : settings.lang === 'el' ? 'el-GR' : 'en-GB';
    u.rate = settings.voiceRate;
    u.volume = settings.voiceVolume;
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith(u.lang.slice(0, 2)));
    const wantFemale = settings.voiceGender === 'femminile';
    const pick =
      voices.find((v) => /female|donna|elsa|alice|paola/i.test(v.name) === wantFemale) ?? voices[0];
    if (pick) u.voice = pick;
    u.onend = () => this.set('idle');
    u.onerror = () => this.set('error');
    this.utterance = u;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    this.set('playing');
  }

  pause() {
    if (this.audio) this.audio.pause();
    else if ('speechSynthesis' in window) speechSynthesis.pause();
    this.set('paused');
  }
  resume() {
    if (this.audio) this.audio.play().catch(() => this.set('error'));
    else if ('speechSynthesis' in window) speechSynthesis.resume();
    this.set('playing');
  }
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.utterance = null;
    this.set('idle');
  }
}

export const ttsPlayer = new TtsPlayer();

/** Annuncio breve di arrivo (sempre via Web Speech, immediato). */
export function announceArrival(placeName: string, settings: Settings) {
  const text = `Sei arrivato alla destinazione: ${placeName}.`;
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
  if (settings.notificationsConsent && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Sei arrivato!', { body: placeName, icon: './icons/icon-192.png' });
    } catch { /* alcuni browser richiedono il service worker */ }
  }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.volume = settings.voiceVolume;
    speechSynthesis.speak(u);
  }
}
