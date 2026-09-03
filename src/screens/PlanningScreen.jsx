import { usePlanning } from "../hooks/usePlanning";
import { Icon } from "../components/Icon";
import "./PlanningScreen.css";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function PlanningScreen() {
  const { days, loading } = usePlanning();

  if (loading) return <div className="today-loading">Chargement…</div>;

  const weeks = chunk(days, 7);
  const done = days.filter((d) => d.status === "done").length;
  const missed = days.filter((d) => d.status === "missed").length;

  return (
    <div className="planning-screen">
      <h2 className="planning-screen__title">Planning</h2>
      <p className="planning-screen__subtitle">
        {done} séance{done > 1 ? "s" : ""} faite{done > 1 ? "s" : ""}
        {missed > 0 && <> · {missed} manquée{missed > 1 ? "s" : ""}</>}
      </p>

      <div className="planning-weeks">
        {weeks.map((week, wi) => (
          <div className="planning-week" key={wi}>
            {week.map((d) => (
              <div key={d.id} className={`planning-day planning-day--${d.status}`}>
                <div className="planning-day__date">
                  {d.dayLabel} {d.dateNum} {d.monthLabel}
                </div>
                {d.status === "done" && <Icon name="check" size={14} className="planning-day__mark" />}
                {d.status === "missed" && <Icon name="x" size={14} className="planning-day__mark planning-day__mark--muted" />}
                {d.status === "today" && <div className="planning-day__now">Aujourd'hui</div>}
                <div className="planning-day__subject">{d.subjects?.label ?? d.label ?? "—"}</div>
                {d.minutes != null && <div className="planning-day__minutes">{d.minutes} min</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
