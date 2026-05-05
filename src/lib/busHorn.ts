/**
 * Som de buzina de ônibus.
 * Browsers bloqueiam autoplay sem gesto do usuário; por isso pré-desbloqueamos
 * o áudio no primeiro toque/clique e reaproveitamos a Audio instance.
 */
let unlocked = false;
let primedAudio: HTMLAudioElement | null = null;

function ensurePrimed() {
  if (primedAudio) return primedAudio;
  primedAudio = new Audio("/sounds/bus-horn.mp3");
  primedAudio.preload = "auto";
  primedAudio.volume = 0.8;
  return primedAudio;
}

function unlockOnce() {
  if (unlocked) return;
  unlocked = true;
  try {
    const a = ensurePrimed();
    // toca mudo rapidamente para liberar o canal de áudio
    const prevVol = a.volume;
    a.volume = 0;
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.volume = prevVol;
      })
      .catch(() => {
        a.volume = prevVol;
      });
  } catch {}
}

if (typeof window !== "undefined") {
  const handler = () => {
    unlockOnce();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
    window.removeEventListener("touchstart", handler);
  };
  window.addEventListener("pointerdown", handler, { once: true });
  window.addEventListener("keydown", handler, { once: true });
  window.addEventListener("touchstart", handler, { once: true });
}

/**
 * Toca a buzina de ônibus duas vezes seguidas.
 */
export function playBusHorn() {
  try {
    const a = ensurePrimed();
    a.currentTime = 0;
    a.volume = 0.8;
    a.play().catch((err) => console.warn("[busHorn] play bloqueado:", err));
    setTimeout(() => {
      try {
        const a2 = new Audio("/sounds/bus-horn.mp3");
        a2.volume = 0.8;
        a2.play().catch(() => {});
      } catch {}
    }, 1300);
  } catch (e) {
    console.warn("[busHorn] erro:", e);
  }
}
