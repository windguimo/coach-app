import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import "./SessionLoading.css";

const STEPS = ["Sélection de la notion", "Rédaction du cours", "Création du quiz"];

const TIPS = [
  "Répondez au quiz sans réfléchir trop longtemps — le premier réflexe compte.",
  "Reformulez l'idée clé dans vos mots juste après le cours, ça aide à la retenir.",
  "Une notion mal maîtrisée revient plus tard dans vos séances — normal, c'est voulu.",
];

export function SessionLoading({ subjectLabel }) {
  const [doneCount, setDoneCount] = useState(0);
  const [pct, setPct] = useState(4);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    const stepId = setInterval(() => {
      setDoneCount((n) => Math.min(n + 1, STEPS.length));
    }, 1700);
    return () => clearInterval(stepId);
  }, []);

  useEffect(() => {
    const pctId = setInterval(() => {
      setPct((p) => Math.min(92, Math.round(p + (92 - p) * 0.08)));
    }, 180);
    return () => clearInterval(pctId);
  }, []);

  return (
    <div className="session-loading">
      <div className="session-loading__card">
        <div className="session-loading__brand">
          <span className="session-loading__brand-mark">
            <Icon name="compass" size={14} />
          </span>
          <span>Coach</span>
        </div>

        <h2 className="session-loading__title">
          Préparation de votre séance{subjectLabel ? <> sur <span className="session-loading__accent">{subjectLabel}</span></> : "…"}
        </h2>

        <div className="session-loading__steps">
          {STEPS.map((label, i) => (
            <div key={label} className="session-loading__step">
              <span className="session-loading__step-label">{label}</span>
              <span className={`session-loading__check${i < doneCount ? " session-loading__check--on" : ""}`}>
                {i < doneCount ? <Icon name="check" size={12} /> : null}
              </span>
            </div>
          ))}

          <div className="session-loading__step">
            <span className="session-loading__step-label">Finalisation</span>
            <span className="session-loading__pct">{pct} %</span>
          </div>
          <div className="session-loading__bar">
            <div className="session-loading__bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="session-loading__tip">
          <span className="accent-tick" />
          {tip}
        </div>
      </div>
    </div>
  );
}
