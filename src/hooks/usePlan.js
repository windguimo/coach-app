import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// The next 7 days starting today (plan_days rows created by apply_onboarding()).
export function usePlan() {
  const { session } = useAuth();
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("plan_days")
      .select("*, subjects(label)")
      .gte("day_date", today)
      .order("day_date", { ascending: true })
      .limit(7);
    const rows = (data ?? []).map((d) => ({
      ...d,
      dayLabel: DAY_LABELS[new Date(d.day_date + "T00:00:00").getDay()],
      dateNum: new Date(d.day_date + "T00:00:00").getDate(),
    }));
    setDays(rows);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const today = days.find((d) => d.status === "today");

  return { days, today, loading, refresh };
}
