import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

export function useSubjects() {
  const { session } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from("subjects").select("*").order("created_at", { ascending: true });
    setSubjects(data ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { subjects, loading, refresh };
}
