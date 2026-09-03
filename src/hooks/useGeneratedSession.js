import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Calls the generate-session Edge Function (Claude generates + caches a
// course module + 2 quiz questions for the subject) and exposes it plus a
// way to record quiz answers against the server-side scoring RPC.
export function useGeneratedSession(subjectId) {
  const [data, setData] = useState(null); // { course_module, quiz_questions }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const generate = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);
    setError(null);
    const { data: result, error: err } = await supabase.functions.invoke("generate-session", {
      body: { subject_id: subjectId },
    });
    if (err) {
      setError(err.message ?? String(err));
      setLoading(false);
      return;
    }
    setData(result);
    setLoading(false);
  }, [subjectId]);

  useEffect(() => {
    generate();
  }, [generate]);

  const recordAttempt = useCallback(async (questionId, picked) => {
    const { data: result, error: err } = await supabase.rpc("record_quiz_attempt", {
      p_question_id: questionId,
      p_picked: picked,
    });
    if (err) throw err;
    return result; // { correct, xp_awarded, xp_total, streak_days }
  }, []);

  return { data, loading, error, recordAttempt, regenerate: generate };
}
