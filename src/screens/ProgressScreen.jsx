import { Icon } from "../components/Icon";
import { Heatmap, LevelRing, MasteryList } from "../components/ProgressWidgets";
import { useProfile, levelFromXp } from "../hooks/useProfile";
import { useNotions } from "../hooks/useNotions";
import { useActivity } from "../hooks/useActivity";
import { useMilestones } from "../hooks/useMilestones";
import "./ProgressScreen.css";

export function ProgressScreen() {
  const { profile, loading: pLoading } = useProfile();
  const { notions, loading: nLoading } = useNotions();
  const { cells, loading: aLoading } = useActivity();
  const { milestones, loading: mLoading } = useMilestones();

  if (pLoading || nLoading || aLoading || mLoading) return <div className="today-loading">Chargement…</div>;

  const { level, xpToNext, progressPct } = levelFromXp(profile.xp);
  const daysSince = profile.created_at
    ? Math.max(1, Math.round((Date.now() - new Date(profile.created_at).getTime()) / 86400000))
    : 0;

  return (
    <div className="progress-screen">
      <h2 className="progress-screen__title">Progression</h2>
      <div className="progress-screen__subtitle">Depuis {daysSince} jour{daysSince > 1 ? "s" : ""}</div>

      <div className="progress-level-card">
        <LevelRing level={level} progressPct={progressPct} size={76} />
        <div>
          <div className="progress-level-card__title">Niveau {level}</div>
          <p className="progress-level-card__text">
            {xpToNext} XP avant le niveau {level + 1}.
          </p>
        </div>
      </div>

      {notions.length > 0 ? (
        <div className="progress-section">
          <div className="section-label">Maîtrise par notion</div>
          <MasteryList items={notions.map((n) => ({ notion: n.label, level: n.status_label, filled: n.filled }))} />
        </div>
      ) : (
        <p style={{ marginTop: 24, fontSize: 13.5, color: "var(--ink-62)" }}>
          Faites votre première séance pour voir vos notions apparaître ici.
        </p>
      )}

      <div className="progress-section">
        <div className="progress-section__head">
          <div className="section-label">Assiduité — 8 semaines</div>
          <div className="progress-section__streak">
            série de {profile.streak_days} jour{profile.streak_days > 1 ? "s" : ""}
          </div>
        </div>
        <Heatmap cells={cells} />
      </div>

      {milestones.length > 0 && (
        <div className="progress-section">
          <div className="section-label">Paliers</div>
          <div className="paliers-row">
            {milestones.map((m) => (
              <div key={m.key} className={`paliers-chip${m.reached ? " paliers-chip--reached" : ""}`}>
                <Icon name={m.icon} size={20} style={{ display: "block", marginBottom: 7 }} />
                {m.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
