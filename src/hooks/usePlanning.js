import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const PAST_DAYS = 7;
const FUTURE_DAYS = 14;

// A rolling 3-week view: the last 7 days + today + the next 14 days.
// ensure_plan_days() extends the schedule forward and reconciles past days
// against real activity (done vs missed) before we read it.
//
// A calendar day can now carry more than one row (per-subject weekly
// frequency) — group plan_days rows by day_date so each entry here is one
// day with its own list of scheduled sessions, not a raw row.
export function usePlanning() {
  const { session } = useAuth();
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) return;
    await supabase.rpc("ensure_plan_days", { p_days_ahead: FUTURE_DAYS });

    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - PAST_DAYS);
    const to = new Date(today);
    to.setDate(to.getDate() + FUTURE_DAYS);

    const { data } = await supabase
      .from("plan_days")
      .select("*, subjects(label, tone)")
      .gte("day_date", from.toISOString().slice(0, 10))
      .lte("day_date", to.toISOString().slice(0, 10))
      .order("day_date", { ascending: true });

    const byDate = new Map();
    for (const row of data ?? []) {
      if (!byDate.has(row.day_date)) byDate.set(row.day_date, []);
      byDate.get(row.day_date).push(row);
    }

    // Walk every calendar date in range, not just dates with rows — a
    // subject set to less than every active day can leave a date with zero
    // scheduled sessions, and the grid needs a stable 7-per-week alignment
    // regardless (an entirely missing date would shift the whole grid).
    const rows = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const day_date = d.toISOString().slice(0, 10);
      rows.push({
        id: day_date,
        day_date,
        sessions: byDate.get(day_date) ?? [],
        dayLabel: DAY_LABELS[d.getDay()],
        dateNum: d.getDate(),
        monthLabel: d.toLocaleDateString("fr-FR", { month: "short" }),
      });
    }
    setDays(rows);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { days, loading, refresh };
}
