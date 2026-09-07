import { Icon } from "../components/Icon";
import { QuizOptions } from "../components/QuizOptions";
import { useReviewQueue } from "../hooks/useReviewQueue";
import { useQuizFlow } from "../hooks/useQuizFlow";
import { supabase } from "../lib/supabaseClient";
import "./SessionScreen.css";
import "./RevisionsScreen.css";

async function recordAttempt(questionId, picked) {
  const { data, error } = await supabase.rpc("record_quiz_attempt", { p_question_id: questionId, p_picked: picked });
  if (error) throw error;
  return data;
}

export function RevisionsScreen() {
  const { questions, loading, error, refresh } = useReviewQueue();
  const quiz = useQuizFlow(questions, recordAttempt);

  if (loading) return <div className="today-loading">Chargement…</div>;

  if (error) {
    return (
      <div className="revisions-screen">
        <p className="quiz-hint">{error}</p>
        <button className="btn-accent" onClick={refresh}>
          Réessayer
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="revisions-screen">
        <h2 className="revisions-screen__title">Révisions</h2>
        <p className="revisions-empty">
          Rien à réviser pour l'instant — soit vous débutez, soit tout est déjà solide. Faites une séance depuis "Aujourd'hui" pour
          alimenter vos révisions.
        </p>
      </div>
    );
  }

  const done = quiz.qi >= questions.length;

  return (
    <div className="revisions-screen">
      <h2 className="revisions-screen__title">Révisions</h2>
      <p className="revisions-screen__subtitle">
        {done ? "Série terminée" : `Question ${quiz.qi + 1} sur ${questions.length}`}
      </p>

      {done ? (
        <div className="revisions-done">
          <div className="revisions-done__text">Bien joué — vous avez fait le tour des révisions du moment.</div>
          <button className="btn-accent" onClick={refresh}>
            Recommencer une série
          </button>
        </div>
      ) : (
        <div className="revisions-card">
          <div className="course-content__eyebrow">
            <span className="accent-tick" />
            <div className="eyebrow">{quiz.question.notions?.label}</div>
          </div>
          <h3 className="revisions-card__prompt">{quiz.question.prompt}</h3>
          <QuizOptions question={quiz.question} picked={quiz.picked} answered={quiz.answered} onPick={quiz.pick} />

          {quiz.answered && quiz.result && (
            <div className="verdict-card">
              <div className="verdict-card__head">
                <span className="verdict-card__tick" />
                <span>{quiz.result.correct ? "Bien vu." : "Presque — voilà pourquoi."}</span>
              </div>
              <p className="verdict-card__why">{quiz.question.explanation}</p>
            </div>
          )}

          {quiz.answered && (
            <div className="revisions-card__footer">
              <div className="quiz-footer-line">
                <span>+{quiz.result?.xp_awarded ?? 0} XP</span>
                <span>Série : {quiz.result?.streak_days ?? "—"} jours</span>
              </div>
              <button onClick={quiz.next} className="btn-accent" style={{ width: "100%" }}>
                {quiz.isLast ? "Terminer" : "Question suivante"}
                <Icon name="arrow-right" size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
