import { useState } from "react";

// Drives a linear list of quiz questions (pick → server-scored result → next),
// shared between SessionScreen (a freshly generated module) and
// RevisionsScreen (a queue of previously generated questions).
// onAnswered (optional) is called after each server-scored answer — used
// for analytics.
export function useQuizFlow(quizQuestions, recordAttempt, onAnswered) {
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null); // { correct, xp_awarded, xp_total, streak_days }
  const [results, setResults] = useState([]); // every scored answer this session, for the end-of-session recap
  const [submitting, setSubmitting] = useState(false);

  const total = quizQuestions?.length ?? 0;
  const question = quizQuestions?.[qi];
  const answered = picked !== null;
  const isLast = qi === total - 1;

  const pick = async (i) => {
    if (picked !== null || !question) return;
    setPicked(i);
    setSubmitting(true);
    try {
      const r = await recordAttempt(question.id, i);
      setResult(r);
      setResults((prev) => [...prev, r]);
      onAnswered?.({ qi, total, correct: Boolean(r?.correct) });
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    setQi((n) => n + 1);
    setPicked(null);
    setResult(null);
  };

  const sessionXp = results.reduce((sum, r) => sum + (r?.xp_awarded ?? 0), 0);
  const correctCount = results.filter((r) => r?.correct).length;
  const lastResult = results[results.length - 1] ?? null;

  return { question, qi, total, answered, isLast, picked, result, submitting, pick, next, sessionXp, correctCount, lastResult };
}
