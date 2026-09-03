import { Icon } from "../components/Icon";
import { Heatmap, LevelRing, MasteryList } from "../components/ProgressWidgets";
import { LEVEL, MASTERY, MILESTONES_PROGRESS } from "../data/content";
import "./ProgressScreen.css";

export function ProgressScreen() {
  return (
    <div className="progress-screen">
      <h2 className="progress-screen__title">Progression</h2>
      <div className="progress-screen__subtitle">Depuis le 14 juillet · 41 séances</div>

      <div className="progress-level-card">
        <LevelRing level={LEVEL.level} progressPct={LEVEL.progressPct} size={76} />
        <div>
          <div className="progress-level-card__title">{LEVEL.title}</div>
          <p className="progress-level-card__text">
            {LEVEL.xpToNext} XP avant le niveau {LEVEL.level + 1}. À ce rythme : dimanche.
          </p>
        </div>
      </div>

      <div className="progress-section">
        <div className="section-label">Maîtrise par notion</div>
        <MasteryList items={MASTERY} />
      </div>

      <div className="progress-section">
        <div className="progress-section__head">
          <div className="section-label">Assiduité — 8 semaines</div>
          <div className="progress-section__streak">série de 12 jours</div>
        </div>
        <Heatmap />
      </div>

      <div className="progress-section">
        <div className="section-label">Paliers</div>
        <div className="paliers-row">
          {MILESTONES_PROGRESS.map((m) => (
            <div key={m.label} className={`paliers-chip${m.reached ? " paliers-chip--reached" : ""}`}>
              <Icon name={m.icon} size={20} style={{ display: "block", marginBottom: 7 }} />
              {m.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
