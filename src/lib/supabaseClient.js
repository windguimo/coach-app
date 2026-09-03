import { createClient } from "@supabase/supabase-js";

// The publishable/anon key is meant to be public — it identifies the project,
// it doesn't authorize anything by itself. Row Level Security policies (see
// supabase/migrations/0001_init.sql) are what actually protect the data.
const SUPABASE_URL = "https://xrmjhsgeipshejfwdklh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_AOekb0yXdT6cYkP_9QqkBQ_EC57KADS";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
