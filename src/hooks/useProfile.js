import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

const LEVEL_XP_STEP = 400;

export function levelFromXp(xp) {
  const level = Math.floor(xp / LEVEL_XP_STEP) + 1;
  const xpToNext = level * LEVEL_XP_STEP - xp;
  const progressPct = ((xp % LEVEL_XP_STEP) / LEVEL_XP_STEP) * 100;
  return { level, xpToNext, progressPct };
}

export function useProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    setProfile(data);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
