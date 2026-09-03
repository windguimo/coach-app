import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Heatmap, LevelRing, MasteryList, MilestoneChips } from "../components/ProgressWidgets";
import { ReminderBanner } from "../components/ReminderBanner";
import { SubjectBadge } from "../components/SubjectBadge";
import "../components/SubjectBadge.css";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useProfile, levelFromXp } from "../hooks/useProfile";
import { useSubjects } from "../hooks/useSubjects";
import { useNotions } from "../hooks/useNotions";
import { usePlan } from "../hooks/usePlan";
import { useActivity } from "../hooks/useActivity";
import { useMilestones } from "../hooks/useMilestones";
import { subjectMasteryPct } from "../lib/mastery";
import "./TodayScreen.css";

function useTodayData() {
  const { profile, loading: pLoading } = useProfile();
  const { subjects, loading: sLoading } = useSubjects();
  const { notions, loading: nLoading } = useNotions();
  const { days, today, loading: planLoading } = usePlan();
  const { cells, loading: aLoading } = useActivity();
  const { milestones, loading: mLoading } = useMilestones();

  const loading = pLoading || sLoading || nLoading || planLoading || aLoading || mLoading;
  return { profile, subjects, notions, days, today, cells, milestones, loading };
}

export function TodayScreen() {
  const isDesktop = useIsDesktop();
  const data = useTodayData();

  if (data.loading) return <div className="today-loading">Chargement…</div>;
  if (data.subjects.length === 0) return <EmptyOnboardingPrompt />;

  return isDesktop ? <TodayDesktop {...data} /> : <TodayMobile {...data} />;
}

function EmptyOnboardingPrompt() {
  return (
    <div className="today-empty">
      <h2>Aucun sujet pour l'instant</h2>
      <p>Choisissez ce sur quoi vous voulez progresser pour que je construise votre premier planning.</p>
      <Link to="/onboarding" className="btn-accent" style={{ width: "fit-content" }}>
        Configurer mes sujets
        <Icon name="arrow-right" size={15} />
      </Link>
    </div>
  );
}

function SessionCTA({ today }) {
  if (!today || !today.subject_id) {
    return <div className="quiz-hint">Rien de prévu aujourd'hui — profitez-en pour réviser une notion.</div>;
  }
  return (
    <Link to={`/session?subject=${today.subject_id}`} className="btn-accent">
      Commencer
      <Icon name="arrow-right" size={15} />
    </Link>
  );
}

// ───────────────────────── Desktop ─────────────────────────

function TodayDesktop({ profile, subjects, notions, days, today, cells, milestones }) {
  const { level, xpToNext, progressPct } = levelFromXp(profile.xp);
  const doneCount = days.filter((d) => d.status === "done").length;
  const remainingMinutes = days.filter((d) => d.status === "today" || d.status === "upcoming").reduce((s, d) => s + (d.minutes || 0), 0);
  const recentNotions = notions.slice(-5).reverse();

  return (
    <div className="today-desktop">
      <div className="today-desktop__center">
        <div className="today-desktop__header">
          <div>
            <div className="eyebrow">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <h2 className="today-desktop__greeting">Bonjour {profile.display_name}.</h2>
            <p className="today-desktop__subtitle">{profile.daily_minutes} minutes aujourd'hui, et la semaine est tenue.</p>
          </div>
          <span className="streak-badge">
            <Icon name="flame" size={14} />
            Série de {profile.streak_days} jour{profile.streak_days > 1 ? "s" : ""}
          </span>
        </div>

        <div className="session-card">
          <div className="session-card__eyebrow">
            <span className="accent-tick" />
            <div className="eyebrow">Séance du jour · {profile.daily_minutes} min</div>
          </div>
          <div className="session-card__row">
            <div>
              <h3 className="session-card__title">{today?.subjects?.label ?? today?.label ?? "—"}</h3>
              <div className="session-card__module">Contenu généré pour votre niveau</div>
            </div>
            <SessionCTA today={today} />
          </div>
        </div>

        <ReminderBanner />

        <div className="today-desktop__week-header">
          <div className="section-label">Vos 7 prochains jours</div>
          <div className="today-desktop__week-meta">
            {doneCount} séance{doneCount > 1 ? "s" : ""} faite{doneCount > 1 ? "s" : ""} · {remainingMinutes} min restantes
          </div>
        </div>
        <div className="week-grid">
          {days.map((d) => {
            const subjectLabel = d.subjects?.label ?? d.label;
            return (
              <div key={d.id} className={`week-cell week-cell--${d.status}`}>
                <div className="week-cell__date">
                  {d.dayLabel} {d.dateNum}
                </div>
                {d.status === "done" && <Icon name="check" size={15} style={{ marginTop: 24, display: "block" }} />}
                {d.status === "missed" && <Icon name="x" size={15} style={{ marginTop: 24, display: "block", color: "var(--ink-4)" }} />}
                {d.status === "today" && <div className="week-cell__now">En cours</div>}
                <div className="week-cell__label">
                  {subjectLabel && <SubjectBadge label={subjectLabel} size={16} />}
                  <span>{subjectLabel ?? (d.status === "off" ? "Repos" : "—")}</span>
                </div>
                {d.minutes != null && <div className="week-cell__minutes">{d.minutes} min</div>}
              </div>
            );
          })}
        </div>

        {recentNotions.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 32 }}>
              Vos notions
            </div>
            <div className="reviews-list">
              {recentNotions.map((n) => (
                <div className="reviews-row" key={n.id}>
                  <span className="reviews-row__when">{n.status_label}</span>
                  <span className="reviews-row__title">{n.label}</span>
                  <span className="reviews-row__subject">{subjects.find((s) => s.id === n.subject_id)?.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <aside className="today-desktop__rail">
        <div className="level-block">
          <LevelRing level={level} progressPct={progressPct} />
          <div>
            <div className="level-block__title">Niveau {level}</div>
            <div className="level-block__xp">
              {profile.xp.toLocaleString("fr-FR")} XP · {xpToNext} avant le {level + 1}
            </div>
          </div>
        </div>

        <div className="section-label" style={{ marginTop: 28 }}>
          Assiduité — 8 semaines
        </div>
        <Heatmap cells={cells} />

        {notions.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 28 }}>
              Maîtrise par notion
            </div>
            <MasteryList items={notions.slice(0, 3).map((n) => ({ notion: n.label, level: n.status_label, filled: n.filled }))} />
          </>
        )}

        {milestones.some((m) => m.reached) && (
          <div className="milestones-card">
            <div className="milestones-card__title">Vos paliers</div>
            <div className="milestones-card__row">
              <MilestoneChips items={milestones.map((m) => ({ icon: m.icon, label: m.label, reached: m.reached }))} />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ───────────────────────── Mobile ─────────────────────────

function TodayMobile({ profile, subjects, notions, today }) {
  return (
    <div className="today-mobile">
      <div className="today-mobile__topline">
        <div className="eyebrow">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</div>
        <span className="streak-badge streak-badge--sm">
          <Icon name="flame" size={13} />
          {profile.streak_days} jour{profile.streak_days > 1 ? "s" : ""}
        </span>
      </div>
      <h2 className="today-mobile__greeting">Bonjour {profile.display_name}.</h2>
      <p className="today-mobile__subtitle">{profile.daily_minutes} minutes aujourd'hui, et la semaine est tenue.</p>

      <div className="session-card session-card--mobile">
        <div className="session-card__eyebrow">
          <span className="accent-tick" />
          <div className="eyebrow">Séance du jour · {profile.daily_minutes} min</div>
        </div>
        <h3 className="session-card__title session-card__title--mobile">{today?.subjects?.label ?? today?.label ?? "—"}</h3>
        <div className="session-card__module">Contenu généré pour votre niveau</div>
        <div style={{ marginTop: 16 }}>
          <SessionCTA today={today} />
        </div>
      </div>

      <ReminderBanner />

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card__value">{profile.xp.toLocaleString("fr-FR")}</div>
          <div className="stat-card__label">XP</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">Niveau {levelFromXp(profile.xp).level}</div>
          <div className="stat-card__label">Praticien</div>
        </div>
      </div>

      <div className="today-mobile__subjects">
        <div className="section-label" style={{ marginBottom: 12 }}>
          Vos sujets
        </div>
        <div className="subjects-list">
          {subjects.map((s) => {
            const pct = subjectMasteryPct(s, notions);
            return (
              <div key={s.id}>
                <div className="subjects-list__row">
                  <span>{s.label}</span>
                  <span className="subjects-list__pct">{pct} %</span>
                </div>
                <div className="subjects-list__track">
                  <div
                    className="subjects-list__fill"
                    style={{ width: `${pct}%`, background: s.tone === "accent" ? "var(--accent)" : "var(--neutral-mark)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
