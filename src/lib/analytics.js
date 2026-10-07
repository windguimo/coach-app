import { supabase } from "./supabaseClient";
import { isStandalone, platform } from "./installPrompt";

// First-party product analytics (see migration 0013). Every event goes to
// `app_events` with:
//   - anon_id: random per-device id, kept in localStorage — the same id
//     before and after signup, so a visitor's whole journey links up;
//   - session_id: per-visit id, rotated after 30 min without any event —
//     visit duration is computed server-side as last − first event, which
//     the heartbeat below keeps accurate;
//   - user_id: set by the database default (auth.uid()) when signed in.
// Fire-and-forget: measurement must never break the app, so failures
// (offline, private mode, RLS edge cases…) are swallowed silently.

const ANON_KEY = "coach:anon-id";
const SESSION_KEY = "coach:visit";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;

let memoryAnonId = null;
let memorySession = null;

function newId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function anonId() {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    memoryAnonId ??= newId();
    return memoryAnonId;
  }
}

function sessionId() {
  const now = Date.now();
  let visit = memorySession;
  try {
    visit = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") ?? visit;
  } catch {
    // keep the in-memory one
  }
  if (!visit || now - visit.last > SESSION_IDLE_MS) visit = { id: newId(), last: now };
  visit.last = now;
  memorySession = visit;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(visit));
  } catch {
    // in-memory fallback already set
  }
  return visit.id;
}

// HashRouter: the app route lives in the hash ("#/today?x=1" → "/today").
function currentPath() {
  return window.location.hash.replace(/^#/, "").split("?")[0] || "/";
}

export function track(event, props = {}) {
  try {
    supabase
      .from("app_events")
      .insert({
        event,
        platform: platform(),
        anon_id: anonId(),
        session_id: sessionId(),
        path: currentPath(),
        props,
      })
      .then(({ error }) => {
        if (error) console.warn("track failed:", event, error.message);
      });
  } catch {
    // never let analytics throw
  }
}

// Original 0011 API (install funnel / push permission) — kept as-is for
// its callers; platform is now always attached by track().
export function logEvent(event) {
  track(event);
}

// Where the visitor came from, attached to page views: ?utm_source= /
// ?ref= on the shared link, else the referring site's host.
function source() {
  const params = new URLSearchParams(window.location.search);
  const tagged = params.get("utm_source") || params.get("ref") || params.get("source");
  if (tagged) return tagged.slice(0, 60);
  try {
    const host = document.referrer ? new URL(document.referrer).host : "";
    return host && host !== window.location.host ? host : "";
  } catch {
    return "";
  }
}

export function trackPageView() {
  track("page_view", { ref: source(), standalone: isStandalone() });
}

// While the tab is visible and the user has interacted in the last few
// minutes, a ping every 30 s so visit duration reflects real time spent
// (a single page view would otherwise count as 0 s, and a tab left open
// on a desk would otherwise count as hours).
const IDLE_AFTER_MS = 3 * 60 * 1000;

export function startHeartbeat() {
  let lastInteraction = Date.now();
  const touch = () => {
    lastInteraction = Date.now();
  };
  const events = ["pointerdown", "keydown", "scroll", "touchstart"];
  events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
  const id = setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - lastInteraction < IDLE_AFTER_MS) track("heartbeat");
  }, HEARTBEAT_MS);
  return () => {
    clearInterval(id);
    events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
  };
}
