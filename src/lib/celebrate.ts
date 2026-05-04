import confetti from "canvas-confetti";

/**
 * Dispara animação de confetti em camadas para celebrar a aprovação da pré-reserva.
 * Uso: import { celebrateApproval } from "@/lib/celebrate";
 */
export function celebrateApproval() {
  // Som de fogos + gritos da galera
  try {
    const fw = new Audio("/sounds/celebrate.mp3");
    fw.volume = 0.7;
    fw.play().catch(() => {});
    const cheer = new Audio("/sounds/cheer.mp3");
    cheer.volume = 0.6;
    setTimeout(() => cheer.play().catch(() => {}), 250);
  } catch {}

  const duration = 2500;
  const end = Date.now() + duration;
  const colors = ["#FE4E03", "#3B82F6", "#10B981", "#F59E0B", "#FFFFFF"];

  // Burst inicial central
  confetti({
    particleCount: 120,
    spread: 90,
    origin: { y: 0.6 },
    colors,
  });

  // Bursts laterais contínuos
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
