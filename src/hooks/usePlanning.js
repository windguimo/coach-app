import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const PAST_DAYS = 7;
const FUTURE_DAYS = 14;

// A rolling 3-week view: the last 7 days + today + the next 14 days.
// ensure_plan_days() extends the schedule forward and reconciles past days
// against real activity (done vs missed) before we read it.
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

    const rows = (data ?? []).map((d) => {
      const date = new Date(d.day_date + "T00:00:00");
      return { ...d, dayLabel: DAY_LABELS[date.getDay()], dateNum: date.getDate(), monthLabel: date.toLocaleDateString("fr-FR", { month: "short" }) };
    });
    setDays(rows);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { days, loading, refresh };
}
