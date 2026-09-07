import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/auth";

const QUEUE_SIZE = 10;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Questions from previously generated modules whose notion isn't "solide"
// yet — free to serve (no Claude call), and doubles as spaced practice.
export function useReviewQueue() {
  const { session } = useAuth();
  const [questions, setQuestions] = useState(null); // null = loading
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setQuestions(null);
    setError(null);
    const { data, error: err } = await supabase
      .from("quiz_questions")
      .select("*, notions!inner(label, filled, status_label)")
      .lt("notions.filled", 5)
      .limit(50);
    if (err) {
      setError(err.message);
      setQuestions([]);
      return;
    }
    setQuestions(shuffle(data ?? []).slice(0, QUEUE_SIZE));
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { questions, loading: questions === null, error, refresh };
}
