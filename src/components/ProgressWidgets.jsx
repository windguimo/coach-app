import { Icon } from "./Icon";
import "./ProgressWidgets.css";

// Shared building blocks for the level ring / attendance heatmap / mastery
// bars — used on both the desktop dashboard rail (7a) and the Progress
// screen (6c).

export function LevelRing({ level, progressPct, size = 70 }) {
  const inner = size - 14;
  return (
    <div
      className="level-ring"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--accent) 0 ${progressPct}%, var(--ink-1) ${progressPct}% 100%)`,
      }}
    >
      <div className="level-ring__inner" style={{ width: inner, height: inner }}>
        <div className="level-ring__num">{level}</div>
        <div className="level-ring__label">niveau</div>
      </div>
    </div>
  );
}

export function Heatmap({ cells }) {
  return (
    <div className="heatmap">
      {cells.map((v, i) => (
        <div key={i} className="heatmap__cell" style={{ background: v == null ? "var(--ink-07)" : `rgba(198,240,74,${v})` }} />
      ))}
    </div>
  );
}

export function MasteryList({ items }) {
  return (
    <div className="mastery-list">
      {items.map((m) => (
        <div key={m.notion} className="mastery-row">
          <div className="mastery-row__head">
            <span>{m.notion}</span>
            <span className="mastery-row__level">{m.level}</span>
          </div>
          <div className="mastery-row__bar">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="mastery-row__seg" style={{ background: i < m.filled ? "var(--accent)" : "var(--ink-1)" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MilestoneChips({ items }) {
  return (
    <div className="milestones-row">
      {items.map((m) => (
        <span key={m.label} className={`milestone-chip${m.reached ? " milestone-chip--reached" : ""}`}>
          <MilestoneIcon name={m.icon} />
          {m.label}
        </span>
      ))}
    </div>
  );
}

function MilestoneIcon({ name }) {
  return <Icon name={name} size={16} style={{ display: "block", marginBottom: 5 }} />;
}
