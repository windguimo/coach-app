import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useQuiz } from "../hooks/useQuiz";
import { COURSE } from "../data/content";
import "./SessionScreen.css";

export function SessionScreen() {
  const isDesktop = useIsDesktop();
  const quiz = useQuiz();
  return isDesktop ? <SessionDesktop quiz={quiz} /> : <SessionMobile quiz={quiz} />;
}

function QuizOptions({ options, size = "md" }) {
  return (
    <div className="quiz-options">
      {options.map((opt) => (
        <button key={opt.label} onClick={opt.pick} className={`quiz-option quiz-option--${opt.kind} quiz-option--${size}`}>
          <span className="quiz-option__label">{opt.label}</span>
          <span className="quiz-option__mark">{opt.mark}</span>
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── Desktop (7b) ─────────────────────────

function SessionDesktop({ quiz }) {
  const navigate = useNavigate();
  const minsLeft = `${quiz.answered ? 8 : 9} min restantes`;

  return (
    <div className="session-desktop">
      <header className="session-desktop__header">
        <button className="session-desktop__back" onClick={() => navigate("/today")} aria-label="Retour">
          <Icon name="arrow-left" size={18} />
        </button>
        <div>
          <div className="session-desktop__title">Négociation commerciale — Ancrer un prix</div>
          <div className="session-desktop__subtitle">Module 3 sur 8 · séance du 3 septembre</div>
        </div>
        <div className="session-desktop__progress">
          <div className="session-desktop__progress-line">
            <span>Étape 2 sur 3</span>
            <span>{minsLeft}</span>
          </div>
          <div className="step-bar">
            <div className="step-bar__seg step-bar__seg--on" />
            <div className="step-bar__seg step-bar__seg--on" />
            <div className="step-bar__seg" />
          </div>
        </div>
        <span className="streak-pill">
          <Icon name="lightning" size={13} />
          {quiz.streak} d'affilée
        </span>
      </header>

      <div className="session-desktop__body">
        <div className="session-desktop__course">
          <div className="course-content">
            <div className="course-content__eyebrow">
              <span className="accent-tick" />
              <div className="eyebrow">{COURSE.eyebrow}</div>
            </div>
            <h2 className="course-content__title">{COURSE.title}</h2>
            {COURSE.paragraphs.map((p, i) => (
              <p className="course-content__p" key={i}>
                {p}
              </p>
            ))}
            <div className="course-content__takeaway">
              <div className="eyebrow" style={{ color: "var(--ink-5)" }}>
                {COURSE.takeawayLabel}
              </div>
              <div className="course-content__takeaway-text">{COURSE.takeaway}</div>
            </div>
            <div className="course-content__footer">
              <span>
                <Icon name="sparkle" size={14} /> {COURSE.note}
              </span>
              <span className="course-content__save">
                <Icon name="bookmark-simple" size={15} /> Enregistrer
              </span>
            </div>
          </div>
        </div>

        <div className="session-desktop__quiz">
          <div className="course-content__eyebrow">
            <span className="accent-tick" />
            <div className="eyebrow">Quiz · {quiz.stepLabel}</div>
          </div>
          <h3 className="session-desktop__prompt">{quiz.prompt}</h3>
          <QuizOptions options={quiz.options} />

          {quiz.answered && (
            <div className="verdict-card">
              <div className="verdict-card__head">
                <span className="verdict-card__tick" />
                <span>{quiz.verdict}</span>
              </div>
              <p className="verdict-card__why">{quiz.why}</p>
            </div>
          )}

          <div className="session-desktop__quiz-spacer" />

          {quiz.answered ? (
            <div>
              <div className="quiz-footer-line">
                <span>{quiz.xpLine}</span>
                <span>Notion ajoutée à vos révisions</span>
              </div>
              <button onClick={quiz.next} className="btn-accent" style={{ width: "100%" }}>
                Question suivante
                <Icon name="arrow-right" size={15} />
              </button>
            </div>
          ) : (
            <div className="quiz-hint">Répondez quand vous voulez — le cours reste à gauche.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Mobile (6b) ─────────────────────────

const MOBILE_SEGMENTS = ["on", "on", "dim", "off", "off", "off"];

function SessionMobile({ quiz }) {
  return (
    <div className="session-mobile">
      <div className="session-mobile__header">
        <Link to="/today" aria-label="Fermer">
          <Icon name="x" size={19} style={{ color: "var(--ink-45)" }} />
        </Link>
        <div className="step-bar step-bar--mobile">
          {MOBILE_SEGMENTS.map((s, i) => (
            <div key={i} className={`step-bar__seg step-bar__seg--${s}`} />
          ))}
        </div>
        <div className="session-mobile__streak">
          <Icon name="lightning" size={14} />
          <span>{quiz.streak}</span>
        </div>
      </div>

      <div className="session-mobile__prompt-block">
        <div className="eyebrow">Négociation · {quiz.stepLabel}</div>
        <h3 className="session-mobile__prompt">{quiz.prompt}</h3>
      </div>

      <div className="session-mobile__options">
        <QuizOptions options={quiz.options} size="lg" />
      </div>

      {quiz.answered && (
        <div className="verdict-card verdict-card--mobile">
          <div className="verdict-card__head">
            <span className="verdict-card__tick" />
            <span>{quiz.verdict}</span>
          </div>
          <p className="verdict-card__why">{quiz.why}</p>
        </div>
      )}

      <div className="session-mobile__spacer" />

      {quiz.answered ? (
        <div className="session-mobile__footer">
          <div className="quiz-footer-line">
            <span>{quiz.xpLine}</span>
            <span>Notion ajoutée à vos révisions</span>
          </div>
          <button onClick={quiz.next} className="btn-accent" style={{ width: "100%", height: 46 }}>
            Question suivante
            <Icon name="arrow-right" size={15} />
          </button>
        </div>
      ) : (
        <div className="session-mobile__footer quiz-hint">
          Touchez une réponse — aucune pénalité, on cherche juste où vous en êtes.
        </div>
      )}
    </div>
  );
}
