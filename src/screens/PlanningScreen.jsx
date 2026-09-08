import { Link } from "react-router-dom";
import { usePlanning } from "../hooks/usePlanning";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { Icon } from "../components/Icon";
import { SubjectBadge } from "../components/SubjectBadge";
import "../components/SubjectBadge.css";
import "./PlanningScreen.css";

const CLICKABLE_STATUSES = ["missed", "today", "upcoming"];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function PlanningScreen() {
  const isDesktop = useIsDesktop();
  const { days, loading } = usePlanning();

  if (loading) return <div className="today-loading">Chargement…</div>;

  const done = days.filter((d) => d.status === "done").length;
  const missed = days.filter((d) => d.status === "missed").length;

  return (
    <div className="planning-screen">
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

      {isDesktop ? <PlanningGrid days={days} /> : <PlanningList days={days} />}
    </div>
  );
}

function dayContent(d, subjectLabel) {
  return (
    <>
      {d.status === "done" && <Icon name="check" size={14} className="planning-day__mark" />}
      {d.status === "missed" && <Icon name="x" size={14} className="planning-day__mark planning-day__mark--muted" />}
      {d.status === "today" && <div className="planning-day__now">Aujourd'hui</div>}
      <div className="planning-day__subject">
        {subjectLabel && <SubjectBadge label={subjectLabel} size={15} />}
        <span>{subjectLabel ?? (d.status === "off" ? "Repos" : "—")}</span>
      </div>
      {d.minutes != null && <div className="planning-day__minutes">{d.minutes} min</div>}
      {d.status === "missed" && <div className="planning-day__cta">Rattraper →</div>}
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
          {week.map((d) => {
            const subjectLabel = d.subjects?.label ?? d.label;
            const clickable = d.subject_id && CLICKABLE_STATUSES.includes(d.status);
            const Tag = clickable ? Link : "div";
            const tagProps = clickable ? { to: `/session?subject=${d.subject_id}` } : {};
            return (
              <Tag
                key={d.id}
                className={`planning-day planning-day--${d.status}${clickable ? " planning-day--clickable" : ""}`}
                {...tagProps}
              >
                <div className="planning-day__date">
                  {d.dayLabel} {d.dateNum} {d.monthLabel}
                </div>
                {dayContent(d, subjectLabel)}
              </Tag>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Mobile: vertical list ─────────────────────────

function PlanningList({ days }) {
  return (
    <div className="planning-list">
      {days.map((d) => {
        const subjectLabel = d.subjects?.label ?? d.label;
        const clickable = d.subject_id && CLICKABLE_STATUSES.includes(d.status);
        const Tag = clickable ? Link : "div";
        const tagProps = clickable ? { to: `/session?subject=${d.subject_id}` } : {};
        return (
          <Tag
            key={d.id}
            className={`planning-row planning-row--${d.status}${clickable ? " planning-row--clickable" : ""}`}
            {...tagProps}
          >
            <div className="planning-row__date">
              <span className="planning-row__day">{d.dayLabel}</span>
              <span className="planning-row__num">{d.dateNum}</span>
            </div>

            <div className="planning-row__body">
              {subjectLabel && <SubjectBadge label={subjectLabel} size={20} />}
              <div className="planning-row__text">
                <div className="planning-row__subject">{subjectLabel ?? (d.status === "off" ? "Repos" : "—")}</div>
                {d.minutes != null && <div className="planning-row__minutes">{d.minutes} min</div>}
              </div>
            </div>

            <div className="planning-row__status">
              {d.status === "done" && <Icon name="check" size={16} />}
              {d.status === "missed" && <span className="planning-row__cta">Rattraper</span>}
              {d.status === "today" && <span className="planning-row__today">Aujourd'hui</span>}
              {d.status === "upcoming" && clickable && <Icon name="caret-right" size={14} style={{ color: "var(--ink-4)" }} />}
            </div>
          </Tag>
        );
      })}
    </div>
  );
}
