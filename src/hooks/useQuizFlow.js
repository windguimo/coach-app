import { useState } from "react";

// Drives a linear list of quiz questions (pick → server-scored result → next),
// shared between SessionScreen (a freshly generated module) and
// RevisionsScreen (a queue of previously generated questions).
export function useQuizFlow(quizQuestions, recordAttempt) {
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null); // { correct, xp_awarded, xp_total, streak_days }
  const [submitting, setSubmitting] = useState(false);

  const question = quizQuestions?.[qi];
  const answered = picked !== null;
  const isLast = qi === (quizQuestions?.length ?? 1) - 1;

  const pick = async (i) => {
    if (picked !== null || !question) return;
    setPicked(i);
    setSubmitting(true);
    try {
      const r = await recordAttempt(question.id, i);
      setResult(r);
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    setQi((n) => n + 1);
    setPicked(null);
    setResult(null);
  };

  return { question, qi, answered, isLast, picked, result, submitting, pick, next };
}
