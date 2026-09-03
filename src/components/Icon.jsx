// Thin wrapper around the Phosphor icon webfont (regular weight) loaded in index.html.
export function Icon({ name, size = 16, style, className = "" }) {
  return (
    <i
      className={`ph ph-${name} ${className}`}
      style={{ fontSize: size, ...style }}
      aria-hidden="true"
    />
  );
}
