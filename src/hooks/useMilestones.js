import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

export function useMilestones() {
  const { session } = useAuth();
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("milestones").select("*");
    setMilestones(data ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { milestones, loading, refresh };
}
