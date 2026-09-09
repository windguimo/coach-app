// Small monochrome initial badge so different subjects are tellable apart at
// a glance in dense grids (week/planning) without introducing new colors —
// the palette reserves the accent for "now" / "success" only.
export function SubjectBadge({ label, size = 18 }) {
  if (!label) return null;
  return (
    <span
      className="subject-badge"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      title={label}
    >
      {label.trim()[0]?.toUpperCase()}
    </span>
  );
}
