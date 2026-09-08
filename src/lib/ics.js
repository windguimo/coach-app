// Builds an .ics (iCalendar, RFC 5545) file from upcoming plan days so users
// can import their Coach schedule into Google/Apple/Outlook calendar and get
// native reminders — more reliable than web push (works offline, no iOS
// PWA-install requirement).

const DEFAULT_HOUR = 8; // floating local time — interpreted in the importing calendar's own timezone

function pad(n) {
  return String(n).padStart(2, "0");
}

function toIcsDateTime(date) {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function escapeText(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function foldLine(line) {
  // RFC 5545: lines should be folded at 75 octets; our lines are short
  // enough in practice, but fold defensively for long subject labels.
  if (line.length <= 75) return line;
  let out = line.slice(0, 75);
  let rest = line.slice(75);
  while (rest.length > 0) {
    out += "\r\n " + rest.slice(0, 74);
    rest = rest.slice(74);
  }
  return out;
}

export function buildPlanningIcs(days) {
  const now = new Date();

  const events = days
    .filter((d) => (d.status === "today" || d.status === "upcoming") && d.subject_id && d.minutes)
    .map((d) => {
      const start = new Date(d.day_date + "T00:00:00");
      start.setHours(DEFAULT_HOUR, 0, 0, 0);
      const end = new Date(start.getTime() + d.minutes * 60000);
      const subjectLabel = d.subjects?.label ?? d.label ?? "Séance";

      const lines = [
        "BEGIN:VEVENT",
        `UID:${d.id}@coach-app`,
        `DTSTAMP:${toIcsDateTime(now)}`,
        `DTSTART:${toIcsDateTime(start)}`,
        `DTEND:${toIcsDateTime(end)}`,
        `SUMMARY:${escapeText(`${subjectLabel} — Séance Coach`)}`,
        `DESCRIPTION:${escapeText(`${d.minutes} min avec Coach`)}`,
        "BEGIN:VALARM",
        "TRIGGER:-PT10M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Rappel séance Coach",
        "END:VALARM",
        "END:VEVENT",
      ];
      return lines.map(foldLine).join("\r\n");
    });

  if (events.length === 0) return null;

  const doc = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Coach//FR",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return doc;
}

export function downloadPlanningIcs(days) {
  const ics = buildPlanningIcs(days);
  if (!ics) return false;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "planning-coach.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
