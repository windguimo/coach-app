import { createClient } from "@supabase/supabase-js";

// The publishable/anon key is meant to be public — it identifies the project,
// it doesn't authorize anything by itself. Row Level Security policies (see
// supabase/migrations/0001_init.sql) are what actually protect the data.
const SUPABASE_URL = "https://xrmjhsgeipshejfwdklh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_AOekb0yXdT6cYkP_9QqkBQ_EC57KADS";

// PKCE puts the auth code in a `?code=` query param instead of a `#access_token=...`
// hash fragment — required here since the app uses HashRouter, which would
// otherwise fight with Supabase over the URL hash on OAuth/recovery redirects.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: "pkce" },
});

export function authRedirectTo(path) {
  // window.location.pathname (not Vite's BASE_URL, which is a relative
  // "./" under our build config and doesn't compose into an absolute URL)
  // — this reads the real deployed path, e.g. "/coach-app/".
  return `${window.location.origin}${window.location.pathname}#${path}`;
}
