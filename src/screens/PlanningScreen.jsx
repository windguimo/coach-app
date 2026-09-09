import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { usePlanning } from "../hooks/usePlanning";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { Icon } from "../components/Icon";
import { SubjectBadge } from "../components/SubjectBadge";
import { downloadPlanningIcs } from "../lib/ics";
import "../components/SubjectBadge.css";
import "./PlanningScreen.css";

const CLICKABLE_STATUSES = ["missed", "today", "upcoming"];

const EXPORT_HINT =
  "Fichier téléchargé. Ouvrez-le depuis l'app Fichiers (ou vos téléchargements) pour l'ajouter à votre calendrier — ou utilisez Safari pour un ajout direct.";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function PlanningScreen() {
  const isDesktop = useIsDesktop();
  const { days, loading } = usePlanning();
  const [exportHint, setExportHint] = useState(false);
  const hintTimeout = useRef(null);

  useEffect(() => () => clearTimeout(hintTimeout.current), []);

  if (loading) return <div className="today-loading">Chargement…</div>;

  // A day now holds a list of sessions (one per due subject) — counts and
  // export work over the flattened list, the grid/list group by day.
  const sessions = days.flatMap((d) => d.sessions);
  const done = sessions.filter((s) => s.status === "done").length;
  const missed = sessions.filter((s) => s.status === "missed").length;

  const canExport = sessions.some((s) => (s.status === "today" || s.status === "upcoming") && s.subject_id);

  function handleExport() {
    const result = downloadPlanningIcs(sessions);
    clearTimeout(hintTimeout.current);
    if (result.mode === "download-hint") {
      setExportHint(true);
      hintTimeout.current = setTimeout(() => setExportHint(false), 8000);
    } else {
      setExportHint(false);
    }
  }

  return (
    <div className="planning-screen">
      <div className="planning-screen__head">
        <div>
          <h2 className="planning-screen__title">Planning</h2>
          <p className="planning-screen__subtitle">
            {done} séance{done > 1 ? "s" : ""} faite{done > 1 ? "s" : ""}
            {missed > 0 && (
              <>
                {" "}
                · {missed} manquée{missed > 1 ? "s" : ""}
              </>
            )}
          </p>
        </div>
        {canExport && (
          <button className="planning-export" onClick={handleExport}>
            <Icon name="calendar-plus" size={14} />
            Ajouter à mon agenda
          </button>
        )}
      </div>

      {exportHint && <p className="planning-export__hint">{EXPORT_HINT}</p>}

      {isDesktop ? <PlanningGrid days={days} /> : <PlanningList days={days} />}
    </div>
  );
}

// One scheduled session within a day cell — a day can render 0, 1 or several.
function sessionContent(s, subjectLabel) {
  return (
    <>
      {s.status === "done" && <Icon name="check" size={14} className="planning-day__mark" />}
      {s.status === "missed" && <Icon name="x" size={14} className="planning-day__mark planning-day__mark--muted" />}
      {s.status === "today" && <div className="planning-day__now">Aujourd'hui</div>}
      <div className="planning-day__subject">
        {subjectLabel && <SubjectBadge label={subjectLabel} size={15} />}
        <span>{subjectLabel ?? (s.status === "off" ? "Repos" : "—")}</span>
      </div>
      {s.minutes != null && <div className="planning-day__minutes">{s.minutes} min</div>}
      {s.status === "missed" && <div className="planning-day__cta">Rattraper →</div>}
    </>
  );
}

// ───────────────────────── Desktop: 7-col grid ─────────────────────────

function PlanningGrid({ days }) {
  const weeks = chunk(days, 7);
  return (
    <div className="planning-weeks">
      {weeks.map((week, wi) => (
        <div className="planning-week" key={wi}>
          {week.map((day) => (
            <div key={day.id} className="planning-day-cell">
              <div className="planning-day__date">
                {day.dayLabel} {day.dateNum} {day.monthLabel}
              </div>
              {day.sessions.length === 0 && <div className="planning-day planning-day--off">{sessionContent({ status: "off" })}</div>}
              {day.sessions.map((s) => {
                const subjectLabel = s.subjects?.label ?? s.label;
                const clickable = s.subject_id && CLICKABLE_STATUSES.includes(s.status);
                const Tag = clickable ? Link : "div";
                const tagProps = clickable ? { to: `/session?subject=${s.subject_id}` } : {};
                return (
                  <Tag
                    key={s.id}
                    className={`planning-day planning-day--${s.status}${clickable ? " planning-day--clickable" : ""}`}
                    {...tagProps}
                  >
                    {sessionContent(s, subjectLabel)}
                  </Tag>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Mobile: vertical list ─────────────────────────

function PlanningList({ days }) {
  return (
    <div className="planning-list">
      {days.map((day) => {
        const sessions = day.sessions.length > 0 ? day.sessions : [{ id: `${day.id}-off`, status: "off" }];
        return (
          <div key={day.id} className="planning-row-group">
            <div className="planning-row__date">
              <span className="planning-row__day">{day.dayLabel}</span>
              <span className="planning-row__num">{day.dateNum}</span>
            </div>
            <div className="planning-row-group__sessions">
              {sessions.map((s) => {
                const subjectLabel = s.subjects?.label ?? s.label;
                const clickable = s.subject_id && CLICKABLE_STATUSES.includes(s.status);
                const Tag = clickable ? Link : "div";
                const tagProps = clickable ? { to: `/session?subject=${s.subject_id}` } : {};
                return (
                  <Tag
                    key={s.id}
                    className={`planning-row planning-row--${s.status}${clickable ? " planning-row--clickable" : ""}`}
                    {...tagProps}
                  >
                    <div className="planning-row__body">
                      {subjectLabel && <SubjectBadge label={subjectLabel} size={20} />}
                      <div className="planning-row__text">
                        <div className="planning-row__subject">{subjectLabel ?? (s.status === "off" ? "Repos" : "—")}</div>
                        {s.minutes != null && <div className="planning-row__minutes">{s.minutes} min</div>}
                      </div>
                    </div>

                    <div className="planning-row__status">
                      {s.status === "done" && <Icon name="check" size={16} />}
                      {s.status === "missed" && <span className="planning-row__cta">Rattraper</span>}
                      {s.status === "today" && <span className="planning-row__today">Aujourd'hui</span>}
                      {s.status === "upcoming" && clickable && <Icon name="caret-right" size={14} style={{ color: "var(--ink-4)" }} />}
                    </div>
                  </Tag>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
