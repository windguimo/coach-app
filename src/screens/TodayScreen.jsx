import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Heatmap, LevelRing, MasteryList, MilestoneChips } from "../components/ProgressWidgets";
import { useIsDesktop } from "../hooks/useIsDesktop";
import {
  LEVEL,
  MASTERY,
  MILESTONES_DASHBOARD,
  SUBJECTS,
  TODAY_SESSION,
  UPCOMING_REVIEWS,
  WEEK,
} from "../data/content";
import "./TodayScreen.css";

export function TodayScreen() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <TodayDesktop /> : <TodayMobile />;
}

function SessionTasks({ dense }) {
  return (
    <div className={`session-tasks${dense ? " session-tasks--grid" : ""}`}>
      {TODAY_SESSION.tasks.map((t) => (
        <div className="session-task" key={t.label}>
          <Icon name={t.icon} size={dense ? 18 : 17} />
          <div className="session-task__label">{t.label}</div>
          <div className="session-task__detail">{t.detail}</div>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Desktop (7a) ─────────────────────────

function TodayDesktop() {
  return (
    <div className="today-desktop">
      <div className="today-desktop__center">
        <div className="today-desktop__header">
          <div>
            <div className="eyebrow">Mardi 3 septembre</div>
            <h2 className="today-desktop__greeting">Bonjour Camille.</h2>
            <p className="today-desktop__subtitle">Quinze minutes aujourd'hui, et la semaine est tenue.</p>
          </div>
          <span className="streak-badge">
            <Icon name="flame" size={14} />
            Série de {TODAY_SESSION.streakDays} jours
          </span>
        </div>

        <div className="session-card">
          <div className="session-card__eyebrow">
            <span className="accent-tick" />
            <div className="eyebrow">Séance du jour · {TODAY_SESSION.minutes} min</div>
          </div>
          <div className="session-card__row">
            <div>
              <h3 className="session-card__title">{TODAY_SESSION.subject}</h3>
              <div className="session-card__module">{TODAY_SESSION.moduleLine}</div>
            </div>
            <Link to="/session" className="btn-accent">
              Commencer
              <Icon name="arrow-right" size={15} />
            </Link>
          </div>
          <SessionTasks dense />
        </div>

        <div className="today-desktop__week-header">
          <div className="section-label">Votre semaine</div>
          <div className="today-desktop__week-meta">3 séances sur 5 · 45 min restantes</div>
        </div>
        <div className="week-grid">
          {WEEK.map((d) => (
            <div key={d.day} className={`week-cell week-cell--${d.state}`}>
              <div className="week-cell__date">
                {d.day} {d.date}
              </div>
              {d.state === "done" && <Icon name="check" size={15} style={{ marginTop: 24, display: "block" }} />}
              {d.state === "today" && <div className="week-cell__now">En cours</div>}
              <div className="week-cell__label">{d.label}</div>
              {"minutes" in d && <div className="week-cell__minutes">{d.minutes} min</div>}
            </div>
          ))}
        </div>

        <div className="section-label" style={{ marginTop: 32 }}>
          À revoir bientôt
        </div>
        <div className="reviews-list">
          {UPCOMING_REVIEWS.map((r) => (
            <div className="reviews-row" key={r.title}>
              <span className="reviews-row__when">{r.when}</span>
              <span className="reviews-row__title">{r.title}</span>
              <span className="reviews-row__subject">{r.subject}</span>
            </div>
          ))}
        </div>
      </div>

      <aside className="today-desktop__rail">
        <div className="level-block">
          <LevelRing level={LEVEL.level} progressPct={LEVEL.progressPct} />
          <div>
            <div className="level-block__title">{LEVEL.title}</div>
            <div className="level-block__xp">
              {LEVEL.xp.toLocaleString("fr-FR")} XP · {LEVEL.xpToNext} avant le {LEVEL.level + 1}
            </div>
          </div>
        </div>

        <div className="section-label" style={{ marginTop: 28 }}>
          Assiduité — 8 semaines
        </div>
        <Heatmap />

        <div className="section-label" style={{ marginTop: 28 }}>
          Maîtrise par notion
        </div>
        <MasteryList items={MASTERY.slice(0, 3)} />

        <div className="milestones-card">
          <div className="milestones-card__title">Deux paliers atteints cette semaine</div>
          <div className="milestones-card__row">
            <MilestoneChips items={MILESTONES_DASHBOARD} />
          </div>
        </div>
      </aside>
    </div>
  );
}

// ───────────────────────── Mobile (6a) ─────────────────────────

function TodayMobile() {
  return (
    <div className="today-mobile">
      <div className="today-mobile__topline">
        <div className="eyebrow">Mardi 3 septembre</div>
        <span className="streak-badge streak-badge--sm">
          <Icon name="flame" size={13} />
          {TODAY_SESSION.streakDays} jours
        </span>
      </div>
      <h2 className="today-mobile__greeting">Bonjour Camille.</h2>
      <p className="today-mobile__subtitle">Quinze minutes aujourd'hui, et la semaine est tenue.</p>

      <div className="session-card session-card--mobile">
        <div className="session-card__eyebrow">
          <span className="accent-tick" />
          <div className="eyebrow">Séance du jour · {TODAY_SESSION.minutes} min</div>
        </div>
        <h3 className="session-card__title session-card__title--mobile">{TODAY_SESSION.subject}</h3>
        <div className="session-card__module">{TODAY_SESSION.moduleLine}</div>
        <div className="session-tasks--list">
          {TODAY_SESSION.tasks.map((t, i) => (
            <div key={t.label}>
              <div className="session-task-row">
                <Icon name={t.icon} size={17} />
                <span className="session-task-row__label">{t.label} — {t.detail.split(" · ")[0]}</span>
                <span className="session-task-row__time">{t.detail.split(" · ")[1]}</span>
              </div>
              {i < TODAY_SESSION.tasks.length - 1 && <div className="session-task-row__divider" />}
            </div>
          ))}
        </div>
        <Link to="/session" className="btn-accent" style={{ marginTop: 16, width: "100%" }}>
          Commencer
          <Icon name="arrow-right" size={15} />
        </Link>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card__value">{LEVEL.xp.toLocaleString("fr-FR")}</div>
          <div className="stat-card__label">XP</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">Niveau {LEVEL.level}</div>
          <div className="stat-card__label">Praticien</div>
        </div>
      </div>

      <div className="today-mobile__subjects">
        <div className="section-label" style={{ marginBottom: 12 }}>
          Vos sujets
        </div>
        <div className="subjects-list">
          {SUBJECTS.map((s) => (
            <div key={s.id}>
              <div className="subjects-list__row">
                <span>{s.labelLong}</span>
                <span className="subjects-list__pct">{s.pct} %</span>
              </div>
              <div className="subjects-list__track">
                <div
                  className="subjects-list__fill"
                  style={{ width: `${s.pct}%`, background: s.tone === "accent" ? "var(--accent)" : "var(--neutral-mark)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
