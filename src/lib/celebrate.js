import confetti from "canvas-confetti";

// Brand colors only — citron accent, ink, and a lighter citron tint.
const COLORS = ["#c6f04a", "#17181a", "#e3f8a5"];

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Small burst from an element (e.g. the quiz option just picked).
export function burstFrom(el) {
  if (!el || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  confetti({
    particleCount: 40,
    spread: 70,
    startVelocity: 28,
    gravity: 0.9,
    scalar: 0.8,
    ticks: 120,
    colors: COLORS,
    origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
    disableForReducedMotion: true,
  });
}

// Full-screen moment (end of session) — two side cannons.
export function bigCelebration() {
  if (reducedMotion()) return;
  const common = { particleCount: 70, spread: 65, startVelocity: 45, colors: COLORS, disableForReducedMotion: true };
  confetti({ ...common, angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...common, angle: 120, origin: { x: 1, y: 0.75 } });
}

// Android only in practice — iOS Safari doesn't implement navigator.vibrate.
export function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // some browsers throw when called without a recent user gesture
  }
}
