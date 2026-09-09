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
//
// Quiz content now lives in the shared content_library_questions table, not
// per user, so we can't filter it directly by the user's notions. Instead
// we start from course_modules (the user's own pointer rows, RLS-scoped),
// reach the shared questions through content_library, and flatten the
// per-module questions back into a single list — each one carrying its
// notion, same shape RevisionsScreen expects.
export function useReviewQueue() {
  const { session } = useAuth();
  const [questions, setQuestions] = useState(null); // null = loading
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    setQuestions(null);
    setError(null);
    const { data, error: err } = await supabase
      .from("course_modules")
      .select(
        "notions!inner(label, filled, status_label), content_library(content_library_questions(id, prompt, options, correct_index, explanation))",
      )
      .lt("notions.filled", 5)
      .limit(50);
    if (err) {
      setError(err.message);
      setQuestions([]);
      return;
    }
    const flattened = (data ?? []).flatMap((row) =>
      (row.content_library?.content_library_questions ?? []).map((q) => ({ ...q, notions: row.notions })),
    );
    setQuestions(shuffle(flattened).slice(0, QUEUE_SIZE));
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { questions, loading: questions === null, error, refresh };
}
