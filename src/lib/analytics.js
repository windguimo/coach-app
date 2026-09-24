import { supabase } from "./supabaseClient";

// Fire-and-forget event logging — measurement must never break the app,
// so failures (offline, RLS edge cases, etc.) are swallowed silently.
export function logEvent(event, platform) {
  supabase
    .from("app_events")
    .insert({ event, platform })
    .then(({ error }) => {
      if (error) console.warn("logEvent failed:", event, error.message);
    });
}
