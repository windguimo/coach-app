import { useMemo, useState } from "react";
import { QUIZ_QUESTIONS } from "../data/content";

// Mirrors the Component logic in the source .dc.html files: cycles through
// QUIZ_QUESTIONS, tracks a running streak, and reveals a verdict once answered.
export function useQuiz() {
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [streak, setStreak] = useState(5);

  const question = QUIZ_QUESTIONS[qi % QUIZ_QUESTIONS.length];
  const answered = picked !== null;
  const right = answered && picked === question.correct;

  const pick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    setStreak((s) => (i === question.correct ? s + 1 : 0));
  };

  const next = () => {
    setQi((n) => n + 1);
    setPicked(null);
  };

  const options = useMemo(
    () =>
      question.options.map((label, i) => {
        let kind = "idle";
        if (answered) kind = i === question.correct ? "correct" : i === picked ? "wrong" : "dim";
        return {
          label,
          kind,
          mark: answered ? (i === question.correct ? "✓" : i === picked ? "×" : "") : "",
          pick: () => pick(i),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question, answered, picked]
  );

  return {
    stepLabel: `question ${(qi % QUIZ_QUESTIONS.length) + 3} sur 6`,
    prompt: question.prompt,
    why: question.why,
    options,
    answered,
    right,
    verdict: right ? "Bien vu." : "Presque — voilà pourquoi.",
    xpLine: right ? "+25 XP" : "+5 XP pour l'essai",
    streak,
    next,
  };
}
