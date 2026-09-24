// Platform/standalone detection + the beforeinstallprompt capture, plus the
// local (per-device) anti-fatigue state for the install banner. None of
// this is server data — installability is inherently a per-browser thing,
// so it lives in localStorage, not Supabase.

const DISMISS_KEY = "coach:install-prompt";
const MAX_SHOWN = 3;
const MIN_GAP_DAYS = 3;

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function platform() {
  if (isIOS()) return "ios";
  if (/Android/.test(navigator.userAgent)) return "android";
  if (/Mobi/.test(navigator.userAgent)) return "other-mobile";
  return "desktop";
}

// beforeinstallprompt can fire before React mounts, so it's captured at
// module load (not inside a component effect) and read by whoever asks.
let deferredPrompt = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });
}

export function getDeferredPrompt() {
  return deferredPrompt;
}

export function clearDeferredPrompt() {
  deferredPrompt = null;
}

function readState() {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY)) ?? { count: 0, lastShownAt: null };
  } catch {
    return { count: 0, lastShownAt: null };
  }
}

function writeState(state) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures (private browsing, quota) — worst case the
    // banner reappears more than intended, not worth failing over
  }
}

// Shown at most MAX_SHOWN times, each at least MIN_GAP_DAYS apart.
export function shouldShowInstallPrompt() {
  const { count, lastShownAt } = readState();
  if (count >= MAX_SHOWN) return false;
  if (!lastShownAt) return true;
  const daysSince = (Date.now() - lastShownAt) / (1000 * 60 * 60 * 24);
  return daysSince >= MIN_GAP_DAYS;
}

export function recordInstallPromptShown() {
  const { count } = readState();
  writeState({ count: count + 1, lastShownAt: Date.now() });
}
