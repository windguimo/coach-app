import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useAuth } from "../lib/auth";
import { useProfile, levelFromXp } from "../hooks/useProfile";
import { useSubjects } from "../hooks/useSubjects";
import { useNotions } from "../hooks/useNotions";
import { subjectMasteryPct } from "../lib/mastery";
import { supabase } from "../lib/supabaseClient";
import { SESSION_FREQUENCIES } from "../data/content";
import "./ProfileScreen.css";

// Postgres dow convention (0=Sun..6=Sat), Mon..Sun display order.
const DAY_NAMES = [
  { label: "Lun", dow: 1 },
  { label: "Mar", dow: 2 },
  { label: "Mer", dow: 3 },
  { label: "Jeu", dow: 4 },
  { label: "Ven", dow: 5 },
  { label: "Sam", dow: 6 },
  { label: "Dim", dow: 0 },
];

export function ProfileScreen() {
  const { session } = useAuth();
  const { profile, loading } = useProfile();
  const { subjects, loading: subjectsLoading, refresh: refreshSubjects } = useSubjects();
  const { notions, loading: notionsLoading } = useNotions();

  if (loading || subjectsLoading || notionsLoading || !profile) return <div className="today-loading">Chargement…</div>;

  // Changing a subject's frequency re-triggers the scheduler for future days
  // (see update_subject_frequency) — refresh subjects so the chip reflects
  // it immediately; Today/Planning pick up the new schedule on their own
  // next refresh (they call ensure_plan_days on mount).
  const setSubjectFrequency = async (subjectId, sessionsPerWeek) => {
    const { error } = await supabase.rpc("update_subject_frequency", {
      p_subject_id: subjectId,
      p_sessions_per_week: sessionsPerWeek,
    });
    if (!error) refreshSubjects();
  };

  const activeDays = profile.active_days ?? [0, 1, 2, 3, 4, 5, 6];
  const daysLabel =
    activeDays.length === 7 ? "Tous les jours" : DAY_NAMES.filter((d) => activeDays.includes(d.dow)).map((d) => d.label).join(", ");

  const { level } = levelFromXp(profile.xp);
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="profile-screen">
      <div className="profile-header">
        <span className="profile-header__avatar">{profile.initials}</span>
        <div>
          <h2 className="profile-header__name">{profile.display_name}</h2>
          <div className="profile-header__email">{session?.user?.email}</div>
        </div>
      </div>

      <div className="profile-stats">
        <div className="profile-stat">
          <div className="profile-stat__value">{profile.xp.toLocaleString("fr-FR")}</div>
          <div className="profile-stat__label">XP</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat__value">Niveau {level}</div>
          <div className="profile-stat__label">Praticien</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat__value">{profile.streak_days}</div>
          <div className="profile-stat__label">jours de série</div>
        </div>
      </div>

      {memberSince && <p className="profile-since">Membre depuis {memberSince}</p>}

      <div className="profile-section">
        <div className="profile-section__head">
          <div className="section-label">Vos sujets & rythme</div>
          <Link to="/onboarding" className="profile-section__edit">
            Modifier
          </Link>
        </div>

        {subjects.length === 0 ? (
          <p className="profile-empty">Aucun sujet configuré pour l'instant.</p>
        ) : (
          <ul className="profile-subjects">
            {subjects.map((s) => {
              const pct = subjectMasteryPct(s, notions);
              return (
                <li key={s.id} className="profile-subject">
                  <div className="profile-subject__row">
                    <span>{s.label}</span>
                    <span className="profile-subject__pct">{pct} %</span>
                  </div>
                  <div className="profile-subject__track">
                    <div
                      className="profile-subject__fill"
                      style={{ width: `${pct}%`, background: s.tone === "accent" ? "var(--accent)" : "var(--neutral-mark)" }}
                    />
                  </div>
                  <div className="profile-subject__freqs">
                    {SESSION_FREQUENCIES.map((f) => (
                      <button
                        key={f.value}
                        className={`freq-chip${(s.sessions_per_week ?? 7) === f.value ? " freq-chip--on" : ""}`}
                        onClick={() => setSubjectFrequency(s.id, f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="profile-pace">
          <Icon name="clock" size={14} style={{ color: "var(--ink-45)" }} />
          {profile.daily_minutes} min par jour · {daysLabel}
        </div>
      </div>

      <button className="profile-signout" onClick={() => supabase.auth.signOut()}>
        <Icon name="sign-out" size={16} />
        Se déconnecter
      </button>
    </div>
  );
}
