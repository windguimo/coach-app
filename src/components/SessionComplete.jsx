import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { levelFromXp } from "../hooks/useProfile";
import { supabase } from "../lib/supabaseClient";
import { bigCelebration, vibrate } from "../lib/celebrate";
import "./SessionComplete.css";

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function useCountUp(target, duration = 900, delay = 300) {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  useEffect(() => {
    if (reducedMotion()) return;
    let raf;
    let start;
    const timer = setTimeout(() => {
      const step = (t) => {
        if (start === undefined) start = t;
        const p = Math.min(1, (t - start) / duration);
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return value;
}

function headline(correct, total) {
  if (total > 0 && correct === total) return ["Sans faute.", "Toutes les réponses justes — la notion est bien ancrée."];
  if (correct * 2 >= total) return ["Séance bouclée.", "Bon travail. Les questions ratées reviendront en révision."];
  return ["Séance bouclée.", "Pas facile, celle-là — ces notions reviendront en révision pour s'installer."];
}

// End-of-session recap: XP count-up, streak (+1 if this session extended
// it), notion mastery bar filling from its pre-session value, level-up if
// crossed. streakBefore comes from the profile as loaded when the session
// screen opened, before any answer was scored.
export function SessionComplete({ quiz, notionId, streakBefore }) {
  const [notion, setNotion] = useState(null);
  const [barReady, setBarReady] = useState(false);
  const fired = useRef(false);

  const { sessionXp, correctCount, total, lastResult } = quiz;
  const streak = lastResult?.streak_days ?? streakBefore ?? 0;
  const streakUp = streakBefore != null && streak > streakBefore;
  const xpTotal = lastResult?.xp_total ?? null;
  const levelUp = xpTotal != null && levelFromXp(xpTotal).level > levelFromXp(xpTotal - sessionXp).level;
  const xpShown = useCountUp(sessionXp);
  const [title, subtitle] = headline(correctCount, total);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    bigCelebration();
    vibrate([40, 30, 40]);
  }, []);

  useEffect(() => {
    if (!notionId) return;
    supabase
      .from("notions")
      .select("label, filled, status_label")
      .eq("id", notionId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setNotion(data);
        // next frame: render at the "before" width first so the fill animates
        requestAnimationFrame(() => requestAnimationFrame(() => setBarReady(true)));
      });
  }, [notionId]);

  const filledBefore = notion ? Math.max(0, notion.filled - correctCount) : 0;
  const barPct = notion ? ((barReady ? notion.filled : filledBefore) / 5) * 100 : 0;

  return (
    <div className="session-complete">
      <div className="session-complete__badge">
        <Icon name="check" size={34} />
      </div>
      <h2 className="session-complete__title">{title}</h2>
      <p className="session-complete__subtitle">{subtitle}</p>

      <div className="session-complete__stats">
        <div className="session-complete__stat" style={{ animationDelay: "0.15s" }}>
          <div className="session-complete__stat-value">+{xpShown}</div>
          <div className="session-complete__stat-label">XP gagnés</div>
        </div>
        <div className="session-complete__stat" style={{ animationDelay: "0.25s" }}>
          <div className="session-complete__stat-value">
            {correctCount}/{total}
          </div>
          <div className="session-complete__stat-label">bonnes réponses</div>
        </div>
        <div className="session-complete__stat" style={{ animationDelay: "0.35s" }}>
          <div className="session-complete__stat-value">
            <Icon name="flame" size={18} className={`session-complete__flame${streakUp ? " session-complete__flame--up" : ""}`} />
            {streak}
            {streakUp && <span className="session-complete__plus">+1</span>}
          </div>
          <div className="session-complete__stat-label">jour{streak > 1 ? "s" : ""} de série</div>
        </div>
      </div>

      {levelUp && (
        <div className="session-complete__levelup">
          <Icon name="star" size={15} />
          Niveau {levelFromXp(xpTotal).level} atteint
        </div>
      )}

      {notion && (
        <div className="session-complete__notion">
          <div className="session-complete__notion-row">
            <span>{notion.label}</span>
            <span className="session-complete__notion-status">{notion.status_label}</span>
          </div>
          <div className="session-complete__track">
            <div className="session-complete__fill" style={{ width: `${barPct}%` }} />
          </div>
        </div>
      )}

      <div className="session-complete__actions">
        <Link to="/today" className="btn-accent">
          Retour à Aujourd'hui
          <Icon name="arrow-right" size={15} />
        </Link>
        <Link to="/revisions" className="session-complete__secondary">
          Réviser mes notions
        </Link>
      </div>
    </div>
  );
}
