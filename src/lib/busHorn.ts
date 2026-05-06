/**
 * Buzina de ônibus — abordagem robusta usando Web Audio API.
 *
 * Por que Web Audio em vez de <audio>:
 *  - Em iOS/Android e em vários navegadores desktop, o autoplay de <audio>
 *    fora de um gesto direto é frequentemente bloqueado, mesmo após pré-unlock.
 *  - Com AudioContext, basta um único gesto inicial para "destravar" o contexto;
 *    a partir daí podemos tocar buffers a qualquer momento, inclusive em
 *    callbacks assíncronos (realtime, useEffect, etc.).
 */

const SOUND_URL = "/sounds/bus-horn.mp3";

let audioCtx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let bufferPromise: Promise<AudioBuffer> | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor: typeof AudioContext | undefined =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx = new Ctor();
  return audioCtx;
}

async function loadBuffer(): Promise<AudioBuffer | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  if (buffer) return buffer;
  if (bufferPromise) return bufferPromise;
  bufferPromise = (async () => {
    const res = await fetch(SOUND_URL);
    const arr = await res.arrayBuffer();
    buffer = await new Promise<AudioBuffer>((resolve, reject) => {
      // decodeAudioData precisa de callback no Safari antigo
      try {
        const p = ctx.decodeAudioData(arr.slice(0), resolve, reject);
        if (p && typeof (p as any).then === "function") {
          (p as Promise<AudioBuffer>).then(resolve, reject);
        }
      } catch (e) {
        reject(e);
      }
    });
    return buffer;
  })();
  try {
    return await bufferPromise;
  } catch (e) {
    console.warn("[busHorn] falha ao decodificar áudio:", e);
    bufferPromise = null;
    return null;
  }
}

function unlock() {
  if (unlocked) return;
  const ctx = getCtx();
  if (!ctx) return;
  unlocked = true;
  // Resume contexto e dispara um buffer silencioso para destravar mobile
  const resume = ctx.resume?.();
  Promise.resolve(resume).catch(() => {}).finally(() => {
    try {
      const silent = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
  });
  // Pré-carrega o buffer real
  loadBuffer();
}

if (typeof window !== "undefined") {
  const handler = () => {
    unlock();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("touchstart", handler);
    window.removeEventListener("keydown", handler);
    window.removeEventListener("click", handler);
  };
  window.addEventListener("pointerdown", handler, { passive: true });
  window.addEventListener("touchstart", handler, { passive: true });
  window.addEventListener("keydown", handler);
  window.addEventListener("click", handler);
}

async function playOnce(volume = 0.85, when = 0): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") await ctx.resume();
  } catch {}
  const buf = await loadBuffer();
  if (!buf) return false;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    src.start(ctx.currentTime + when);
    return true;
  } catch (e) {
    console.warn("[busHorn] erro ao tocar buffer:", e);
    return false;
  }
}

/** Fallback simples via <audio> caso Web Audio falhe */
function fallbackPlay() {
  try {
    const a = new Audio(SOUND_URL);
    a.volume = 0.85;
    a.play().catch((err) => console.warn("[busHorn] fallback bloqueado:", err));
    setTimeout(() => {
      try {
        const a2 = new Audio(SOUND_URL);
        a2.volume = 0.85;
        a2.play().catch(() => {});
      } catch {}
    }, 1300);
  } catch {}
}

/** Toca a buzina (arquivo já contém 2 buzinadas). */
export async function playBusHorn() {
  unlock();
  const ok = await playOnce(0.9, 0);
  if (!ok) fallbackPlay();
}

/** Versão síncrona — usar dentro de handlers de clique para garantir playback. */
export function playBusHornFromGesture() {
  unlock();
  void playOnce(0.9, 0);
  try {
    const a = new Audio(SOUND_URL);
    a.volume = 0.9;
    a.play().catch(() => {});
  } catch {}
}
