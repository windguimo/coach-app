import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { SessionLoading } from "../components/SessionLoading";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useGeneratedSession } from "../hooks/useGeneratedSession";
import { useSubjects } from "../hooks/useSubjects";
import "./SessionScreen.css";

function optionKind(i, correctIndex, picked, answered) {
  if (!answered) return "idle";
  if (i === correctIndex) return "correct";
  if (i === picked) return "wrong";
  return "dim";
}

function useQuizFlow(quizQuestions, recordAttempt) {
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

function QuizOptions({ question, picked, answered, onPick }) {
  return (
    <div className="quiz-options">
      {question.options.map((label, i) => (
        <button
          key={i}
          onClick={() => onPick(i)}
          className={`quiz-option quiz-option--${optionKind(i, question.correct_index, picked, answered)}`}
        >
          <span className="quiz-option__label">{label}</span>
          <span className="quiz-option__mark">{answered ? (i === question.correct_index ? "✓" : i === picked ? "×" : "") : ""}</span>
        </button>
      ))}
    </div>
  );
}

export function SessionScreen() {
  const isDesktop = useIsDesktop();
  const [params] = useSearchParams();
  const subjectId = params.get("subject");
  const { data, loading, error, recordAttempt, regenerate } = useGeneratedSession(subjectId);
  const quiz = useQuizFlow(data?.quiz_questions, recordAttempt);
  const { subjects } = useSubjects();
  const subjectLabel = subjects.find((s) => s.id === subjectId)?.label;

  if (!subjectId) {
    return (
      <div className="session-empty">
        <p>Aucun sujet sélectionné.</p>
        <Link to="/today" className="btn-accent">
          Retour à Aujourd'hui
        </Link>
      </div>
    );
  }

  if (loading) {
    return <SessionLoading subjectLabel={subjectLabel} />;
  }

  if (error || !data) {
    return (
      <div className="session-empty">
        <p>{error || "Impossible de générer la séance."}</p>
        <button className="btn-accent" onClick={regenerate}>
          Réessayer
        </button>
      </div>
    );
  }

  return isDesktop ? (
    <SessionDesktop courseModule={data.course_module} quiz={quiz} />
  ) : (
    <SessionMobile quiz={quiz} />
  );
}

// ───────────────────────── Desktop ─────────────────────────

function SessionDesktop({ courseModule, quiz }) {
  const navigate = useNavigate();

  return (
    <div className="session-desktop">
      <header className="session-desktop__header">
        <button className="session-desktop__back" onClick={() => navigate("/today")} aria-label="Retour">
          <Icon name="arrow-left" size={18} />
        </button>
        <div>
          <div className="session-desktop__title">{courseModule.title}</div>
          <div className="session-desktop__subtitle">Généré par Claude pour votre niveau</div>
        </div>
        <span className="streak-pill" style={{ marginLeft: "auto" }}>
          <Icon name="lightning" size={13} />
          question {quiz.qi + 1} sur {2}
        </span>
      </header>

      <div className="session-desktop__body">
        <div className="session-desktop__course">
          <div className="course-content">
            <div className="course-content__eyebrow">
              <span className="accent-tick" />
              <div className="eyebrow">{courseModule.eyebrow}</div>
            </div>
            <h2 className="course-content__title">{courseModule.title}</h2>
            {courseModule.paragraphs.map((p, i) => (
              <p className="course-content__p" key={i}>
                {p}
              </p>
            ))}
            <div className="course-content__takeaway">
              <div className="eyebrow" style={{ color: "var(--ink-5)" }}>
                À retenir
              </div>
              <div className="course-content__takeaway-text">{courseModule.takeaway}</div>
            </div>
          </div>
        </div>

        <div className="session-desktop__quiz">
          {quiz.question ? (
            <>
              <div className="course-content__eyebrow">
                <span className="accent-tick" />
                <div className="eyebrow">Quiz · question {quiz.qi + 1} sur 2</div>
              </div>
              <h3 className="session-desktop__prompt">{quiz.question.prompt}</h3>
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

              <div className="session-desktop__quiz-spacer" />

              {quiz.answered ? (
                <div>
                  <div className="quiz-footer-line">
                    <span>+{quiz.result?.xp_awarded ?? 0} XP</span>
                    <span>Série : {quiz.result?.streak_days ?? "—"} jours</span>
                  </div>
                  {quiz.isLast ? (
                    <Link to="/today" className="btn-accent" style={{ width: "100%" }}>
                      Terminer la séance
                      <Icon name="arrow-right" size={15} />
                    </Link>
                  ) : (
                    <button onClick={quiz.next} className="btn-accent" style={{ width: "100%" }}>
                      Question suivante
                      <Icon name="arrow-right" size={15} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="quiz-hint">{quiz.submitting ? "…" : "Répondez quand vous voulez — le cours reste à gauche."}</div>
              )}
            </>
          ) : (
            <div className="quiz-hint">Pas de quiz pour ce module.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Mobile ─────────────────────────

function SessionMobile({ quiz }) {
  if (!quiz.question) {
    return (
      <div className="session-empty">
        <p>Pas de quiz pour ce module.</p>
      </div>
    );
  }

  return (
    <div className="session-mobile">
      <div className="session-mobile__header">
        <Link to="/today" aria-label="Fermer">
          <Icon name="x" size={19} style={{ color: "var(--ink-45)" }} />
        </Link>
        <div className="step-bar step-bar--mobile">
          <div className={`step-bar__seg step-bar__seg--${quiz.qi >= 0 ? "on" : "off"}`} />
          <div className={`step-bar__seg step-bar__seg--${quiz.qi >= 1 ? "on" : "off"}`} />
        </div>
      </div>

      <div className="session-mobile__prompt-block">
        <div className="eyebrow">Question {quiz.qi + 1} sur 2</div>
        <h3 className="session-mobile__prompt">{quiz.question.prompt}</h3>
      </div>

      <div className="session-mobile__options">
        <QuizOptions question={quiz.question} picked={quiz.picked} answered={quiz.answered} onPick={quiz.pick} />
      </div>

      {quiz.answered && quiz.result && (
        <div className="verdict-card verdict-card--mobile">
          <div className="verdict-card__head">
            <span className="verdict-card__tick" />
            <span>{quiz.result.correct ? "Bien vu." : "Presque — voilà pourquoi."}</span>
          </div>
          <p className="verdict-card__why">{quiz.question.explanation}</p>
        </div>
      )}

      <div className="session-mobile__spacer" />

      {quiz.answered ? (
        <div className="session-mobile__footer">
          <div className="quiz-footer-line">
            <span>+{quiz.result?.xp_awarded ?? 0} XP</span>
            <span>Série : {quiz.result?.streak_days ?? "—"} jours</span>
          </div>
          {quiz.isLast ? (
            <Link to="/today" className="btn-accent" style={{ width: "100%", height: 46 }}>
              Terminer la séance
              <Icon name="arrow-right" size={15} />
            </Link>
          ) : (
            <button onClick={quiz.next} className="btn-accent" style={{ width: "100%", height: 46 }}>
              Question suivante
              <Icon name="arrow-right" size={15} />
            </button>
          )}
        </div>
      ) : (
        <div className="session-mobile__footer quiz-hint">Touchez une réponse.</div>
      )}
    </div>
  );
}
