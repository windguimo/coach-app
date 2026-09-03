import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useOnboarding } from "../hooks/useOnboarding";
import "./OnboardingScreen.css";

const STEP = 2;
const TOTAL_STEPS = 4;

export function OnboardingScreen() {
  const ob = useOnboarding();
  const navigate = useNavigate();

  return (
    <div className="onboarding">
      <div className="onboarding__header">
        <Link to="/today" aria-label="Retour">
          <Icon name="arrow-left" size={19} style={{ color: "var(--ink-45)" }} />
        </Link>
        <div className="step-bar">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`step-bar__seg${i < STEP ? " step-bar__seg--on" : " step-bar__seg--off"}`} />
          ))}
        </div>
        <span className="onboarding__step-label">
          {STEP} / {TOTAL_STEPS}
        </span>
      </div>

      <div className="onboarding__intro">
        <h2 className="onboarding__title">Sur quoi voulez-vous progresser ?</h2>
        <p className="onboarding__subtitle">Deux ou trois sujets suffisent pour commencer. Vous pourrez en ajouter à tout moment.</p>
        <div className="onboarding__search">
          <Icon name="magnifying-glass" size={15} style={{ position: "absolute", left: 11, top: 12, color: "var(--ink-45)" }} />
          <input className="onboarding__search-input" placeholder="Écrire un sujet — ex. « pitcher en anglais »" />
        </div>
      </div>

      <div className="onboarding__chips">
        {ob.topics.map((t) => (
          <button key={t.label} onClick={t.toggle} className={`chip${t.on ? " chip--on" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="onboarding__paces">
        <div className="section-label" style={{ marginBottom: 11 }}>
          Votre rythme quotidien
        </div>
        <div className="onboarding__paces-row">
          {ob.paces.map((p) => (
            <button key={p.label} onClick={p.pick} className={`pace-chip${p.on ? " pace-chip--on" : ""}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="plan-preview">
        <div className="plan-preview__head">
          <span className="accent-tick" />
          Votre planning, en direct
        </div>
        <div className="plan-preview__line">{ob.planLine}</div>
        <div className="plan-preview__week">
          {ob.planWeek.map((d, i) => (
            <div
              key={i}
              className="plan-preview__day"
              style={{
                background: !d.on ? "var(--ink-06)" : d.weekend ? "rgba(198,240,74,.45)" : "var(--accent)",
                color: d.on ? "var(--ink)" : "var(--ink-4)",
              }}
            >
              {d.label}
            </div>
          ))}
        </div>
        <div className="plan-preview__note">Séances écourtées le week-end. Modifiable plus tard.</div>
      </div>

      <div className="onboarding__spacer" />

      <div className="onboarding__footer">
        <button className="btn-accent" style={{ width: "100%", height: 46 }} disabled={!ob.canSubmit} onClick={() => navigate("/today")}>
          Construire mon planning
          <Icon name="arrow-right" size={15} />
        </button>
        <div className="onboarding__summary">{ob.selectionSummary}</div>
      </div>
    </div>
  );
}
