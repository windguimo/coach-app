import { useLocation, Link } from "react-router-dom";
import { Icon } from "./Icon";
import { useProfile } from "../hooks/useProfile";
import { useSubjects } from "../hooks/useSubjects";
import { useNotions } from "../hooks/useNotions";
import { subjectMasteryPct } from "../lib/mastery";
import { supabase } from "../lib/supabaseClient";
import "./Sidebar.css";

const NAV = [
  { id: "today", label: "Aujourd'hui", icon: "sun-horizon", to: "/today" },
  { id: "planning", label: "Planning", icon: "calendar-blank", to: null },
  { id: "progress", label: "Progression", icon: "chart-line-up", to: "/progress" },
  { id: "reviews", label: "Révisions", icon: "cards", to: null },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { profile } = useProfile();
  const { subjects } = useSubjects();
  const { notions } = useNotions();

  return (
    <nav className="sidebar" aria-label="Navigation principale">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark">
          <Icon name="compass" size={14} />
        </span>
        <span className="sidebar__brand-name">Coach</span>
      </div>

      <ul className="sidebar__nav">
        {NAV.map((item) => {
          const active = item.to && pathname.startsWith(item.to);
          const content = (
            <>
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
              {active && <span className="sidebar__nav-dot" />}
            </>
          );
          return (
            <li key={item.id}>
              {item.to ? (
                <Link to={item.to} className={`sidebar__nav-item${active ? " sidebar__nav-item--active" : ""}`}>
                  {content}
                </Link>
              ) : (
                <span className="sidebar__nav-item sidebar__nav-item--disabled" title="Bientôt disponible">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sidebar__subjects-label">Vos sujets</div>
      <ul className="sidebar__subjects">
        {subjects.map((s) => {
          const pct = subjectMasteryPct(s, notions);
          return (
            <li key={s.id} className="sidebar__subject">
              <div className="sidebar__subject-row">
                <span>{s.label}</span>
                <span className="sidebar__subject-pct">{pct} %</span>
              </div>
              <div className="sidebar__subject-track">
                <div
                  className="sidebar__subject-fill"
                  style={{ width: `${pct}%`, background: s.tone === "accent" ? "var(--accent)" : "var(--neutral-mark)" }}
                />
              </div>
            </li>
          );
        })}
        <li>
          <Link to="/onboarding" className="sidebar__add-subject">
            <Icon name="plus" size={14} />
            Ajouter un sujet
          </Link>
        </li>
      </ul>

      <div className="sidebar__spacer" />

      <button className="sidebar__user" onClick={() => supabase.auth.signOut()} title="Se déconnecter">
        <span className="sidebar__user-avatar">{profile?.initials ?? "…"}</span>
        {profile?.display_name ?? "…"}
        <Icon name="sign-out" size={14} style={{ marginLeft: "auto", color: "var(--ink-45)" }} />
      </button>
    </nav>
  );
}
