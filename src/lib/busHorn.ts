/**
 * Toca o som de buzina de ônibus duas vezes seguidas.
 */
export function playBusHorn() {
  try {
    const horn = new Audio("/sounds/bus-horn.mp3");
    horn.volume = 0.7;
    horn.play().catch(() => {});
    setTimeout(() => {
      const horn2 = new Audio("/sounds/bus-horn.mp3");
      horn2.volume = 0.7;
      horn2.play().catch(() => {});
    }, 1200);
  } catch {}
}
