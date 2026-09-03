import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

export function useNotions() {
  const { session } = useAuth();
  const [notions, setNotions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("notions").select("*").order("created_at", { ascending: true });
    setNotions(data ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { notions, loading, refresh };
}
