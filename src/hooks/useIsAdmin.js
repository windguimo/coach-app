import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Whether the signed-in user may open /admin (row in public.admins —
// see migration 0013). The dashboard RPC re-checks server-side; this only
// decides whether to show the entry point.
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase.rpc("is_admin").then(({ data }) => {
      if (!cancelled) setIsAdmin(data === true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return isAdmin;
}
