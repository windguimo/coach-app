import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { QuizOptions } from "../components/QuizOptions";
import { useAuth } from "../lib/auth";
import { isStandalone } from "../lib/installPrompt";
import { fetchDemoLesson, isQuizReady, parseDemoLesson } from "../lib/demoLesson";
import { setPendingTopic } from "../lib/pendingTopic";
import { bigCelebration } from "../lib/celebrate";
import { track } from "../lib/analytics";
import { APP_NAME, ONBOARDING_TOPICS } from "../data/content";
import "./SessionScreen.css";
import "./LandingScreen.css";

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// "/" — public landing for signed-out visitors; signed-in users (and the
// installed PWA, which has no use for a marketing page) go straight in.
export function LandingRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/today" replace />;
  if (isStandalone()) return <Navigate to="/login" replace />;
  return <LandingScreen />;
}

// Reveals `target` progressively, a few characters per frame, speeding up
// when it falls behind the network so a cached lesson (arriving all at
// once) still "types" in a couple of seconds.
function useTypewriter(target) {
  const [shown, setShown] = useState(0);
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    const instant = reducedMotion();
    let raf;
    const step = () => {
      setShown((n) => {
        const len = targetRef.current.length;
        if (n >= len) return len; // also resets when a new demo starts
        return instant ? len : Math.min(len, n + Math.max(2, Math.ceil((len - n) / 40)));
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return target.slice(0, shown);
}

// Claude tends to put the right answer in the same slot; shuffle the
// options (stable per question text) so the demo isn't guessable.
function shuffled(options, answerIndex, seedText) {
  let seed = 0;
  for (const ch of seedText) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { options: order.map((i) => options[i]), correct_index: order.indexOf(answerIndex) };
}

const SUGGESTIONS = ONBOARDING_TOPICS.slice(0, 6);

function LandingScreen() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("idle"); // idle | waiting | streaming | done | error
  const [error, setError] = useState(null);
  const [raw, setRaw] = useState("");
  const [picked, setPicked] = useState(null);
  const abortRef = useRef(null);
  const demoRef = useRef(null);
  const ctaRef = useRef(null);

  const visible = useTypewriter(raw);
  const typing = visible.length < raw.length;
  const lesson = useMemo(() => parseDemoLesson(visible), [visible]);
  const full = useMemo(() => parseDemoLesson(raw), [raw]);
  const quizReady = status === "done" && !typing && isQuizReady(full);
  const question = useMemo(
    () => (quizReady ? { ...shuffled(full.options, full.answerIndex, full.question), prompt: full.question } : null),
    [quizReady, full]
  );
  const answered = picked !== null;

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (answered && question && picked === question.correct_index) {
      const t = setTimeout(bigCelebration, 500);
      return () => clearTimeout(t);
    }
  }, [answered, picked, question]);

  useEffect(() => {
    if (answered) setTimeout(() => ctaRef.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" }), 700);
  }, [answered]);

  const generate = async (value, via = "input") => {
    const t = value.replace(/\s+/g, " ").trim();
    if (t.length < 2 || status === "waiting" || status === "streaming") return;
    track("demo_started", { topic: t, via });
    const startedAt = Date.now();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setTopic(t);
    setInput(t);
    setRaw("");
    setPicked(null);
    setError(null);
    setStatus("waiting");
    requestAnimationFrame(() => demoRef.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }));
    try {
      const text = await fetchDemoLesson(t, {
        signal: controller.signal,
        onText: (text) => {
          setRaw(text);
          setStatus("streaming");
        },
      });
      setStatus("done");
      const refused = parseDemoLesson(text).refusal;
      track(refused ? "demo_refused" : "demo_completed", { topic: t, ms: Date.now() - startedAt });
    } catch (err) {
      if (err.name === "AbortError") return;
      track("demo_error", { topic: t, code: err.code || "network" });
      setError({ message: err.message, code: err.code });
      setStatus("error");
    }
  };

  const signup = (where) => {
    track("signup_cta_clicked", { where, topic: topic || null });
    if (topic && !full.refusal) setPendingTopic(topic);
    navigate("/login", { state: { mode: "signup", from: { pathname: "/onboarding" } } });
  };

  const pickAnswer = (i) => {
    setPicked(i);
    track("demo_answered", { topic, correct: i === question.correct_index });
  };

  const busy = status === "waiting" || status === "streaming";
  const showDemo = status !== "idle";

  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="landing__brand">
          <span className="landing__mark">
            <Icon name="compass" size={16} />
          </span>
          {APP_NAME}
        </div>
        <Link to="/login" className="landing__login">
          Se connecter
        </Link>
      </header>

      <section className="landing__hero">
        <div className="landing__eyebrow">
          <span className="accent-tick" />
          Coaching quotidien, écrit sur mesure par l'IA
        </div>
        <h1 className="landing__title">
          Apprenez <span className="landing__highlight">n'importe quoi</span>,<br />
          15 minutes par jour.
        </h1>
        <p className="landing__lead">
          Chaque jour, un mini-cours et un quiz sur le sujet de votre choix. Essayez — tapez ce que vous voulez apprendre,
          votre premier cours s'écrit sous vos yeux.
        </p>

        <form
          className="landing__form"
          onSubmit={(e) => {
            e.preventDefault();
            generate(input);
          }}
        >
          <input
            className="landing__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex. : négocier un salaire, le jazz, Excel…"
            maxLength={80}
            aria-label="Que voulez-vous apprendre ?"
            disabled={busy}
          />
          <button className="btn-accent landing__go" disabled={busy || input.trim().length < 2}>
            {busy ? "Écriture…" : "Générer mon cours"}
            {!busy && <Icon name="sparkle" size={15} />}
          </button>
        </form>

        <div className="landing__chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="landing__chip" onClick={() => generate(s, "chip")} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
      </section>

      {showDemo && (
        <section className="landing__demo" ref={demoRef} aria-busy={busy}>
          <div className="landing__card">
            <div className="landing__card-head">
              <span className="landing__dot" />
              <span>Module 1 · {topic}</span>
              <span className="landing__card-status">
                {status === "waiting" ? "Claude réfléchit…" : busy || typing ? "En cours d'écriture" : status === "error" ? "" : "Prêt"}
              </span>
            </div>

            {status === "waiting" && (
              <div className="landing__waiting">
                <span />
                <span />
                <span />
              </div>
            )}

            {status === "error" && (
              <div className="landing__error">
                <p>{error?.message}</p>
                {error?.code === "rate_limited" ? (
                  <button className="btn-accent" onClick={() => signup("rate_limited")}>
                    Créer mon compte
                    <Icon name="arrow-right" size={15} />
                  </button>
                ) : (
                  <button className="btn-accent" onClick={() => generate(topic, "retry")}>
                    Réessayer
                  </button>
                )}
              </div>
            )}

            {lesson.refusal && <p className="landing__refusal">{lesson.refusal}</p>}

            {!lesson.refusal && lesson.title && (
              <article className="landing__lesson">
                <h2 className="landing__lesson-title">
                  {lesson.title}
                  {typing && !lesson.paragraphs.length && <Caret />}
                </h2>
                {lesson.paragraphs.map((p, i) => (
                  <p key={i} className="landing__p">
                    {p}
                    {typing && i === lesson.paragraphs.length - 1 && !lesson.takeaway && <Caret />}
                  </p>
                ))}
                {lesson.takeaway && (
                  <div className="course-content__takeaway landing__takeaway">
                    <div className="eyebrow" style={{ color: "var(--ink-5)" }}>
                      À retenir
                    </div>
                    <div className="course-content__takeaway-text">
                      {lesson.takeaway}
                      {typing && !lesson.question && <Caret />}
                    </div>
                  </div>
                )}
                {!quizReady && lesson.question && (
                  <div className="landing__quiz-pending">
                    <Icon name="lightning" size={14} /> Préparation de votre question…
                  </div>
                )}
              </article>
            )}
          </div>

          {question && (
            <div className="landing__card landing__quiz">
              <div className="course-content__eyebrow">
                <span className="accent-tick" />
                <div className="eyebrow">À vous de jouer</div>
              </div>
              <h3 className="landing__question">{question.prompt}</h3>
              <QuizOptions question={question} picked={picked} answered={answered} onPick={pickAnswer} />
              {answered && (
                <div className="verdict-card">
                  <div className="verdict-card__head">
                    <span className="verdict-card__tick" />
                    <span>{picked === question.correct_index ? "Bien vu !" : "Presque — voilà pourquoi."}</span>
                  </div>
                  <p className="verdict-card__why">{full.explanation}</p>
                </div>
              )}
            </div>
          )}

          {(answered || full.refusal) && (
            <div className="landing__cta" ref={ctaRef}>
              {full.refusal ? (
                <p className="landing__cta-text">Essayez un autre sujet ci-dessus.</p>
              ) : (
                <>
                  <h3 className="landing__cta-title">Ça vous a plu ? Il y en a un comme ça chaque jour.</h3>
                  <p className="landing__cta-text">
                    Un parcours complet sur « {topic} », à votre rythme, avec des rappels, une série à tenir et des
                    révisions des notions qui résistent.
                  </p>
                  <button className="btn-accent landing__cta-btn" onClick={() => signup("after_demo")}>
                    Créer mon compte gratuit
                    <Icon name="arrow-right" size={15} />
                  </button>
                  <Link to="/login" className="landing__cta-secondary">
                    J'ai déjà un compte
                  </Link>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <section className="landing__features">
        {[
          ["book-open", "Un cours par jour", "Court, concret, une notion à la fois — écrit pour votre sujet, pas un catalogue générique."],
          ["flame", "Une série à tenir", "XP, séries et rappels doux : l'habitude se construit toute seule."],
          ["arrows-clockwise", "Des révisions qui ciblent", "Les notions qui résistent reviennent jusqu'à être solides."],
        ].map(([icon, title, text]) => (
          <div key={title} className="landing__feature">
            <span className="landing__feature-icon">
              <Icon name={icon} size={18} />
            </span>
            <div className="landing__feature-title">{title}</div>
            <p className="landing__feature-text">{text}</p>
          </div>
        ))}
      </section>

      <footer className="landing__footer">
        <button className="btn-accent" onClick={() => signup("footer")}>
          Commencer gratuitement
        </button>
      </footer>
    </div>
  );
}

function Caret() {
  return <span className="landing__caret" aria-hidden="true" />;
}
