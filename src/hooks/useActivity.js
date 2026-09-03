import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

const WEEKS = 8;
const CELLS = WEEKS * 7;

// Returns an array of `intensity` values (0-1 or null for no activity), oldest
// first, one per day for the last 8 weeks — same shape the Heatmap component
// expects, just backed by real rows instead of a fixture.
export function useActivity() {
  const { session } = useAuth();
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) return;
    const since = new Date();
    since.setDate(since.getDate() - (CELLS - 1));
    const sinceStr = since.toISOString().slice(0, 10);

    const { data } = await supabase.from("activity_log").select("activity_date, intensity").gte("activity_date", sinceStr);
    const byDate = new Map((data ?? []).map((r) => [r.activity_date, r.intensity]));

    const out = [];
    for (let i = 0; i < CELLS; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      out.push(byDate.has(key) ? byDate.get(key) : null);
    }
    setCells(out);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { cells, loading, refresh };
}
