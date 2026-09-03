// Derives a subject's mastery % from its notions (average of filled/5),
// since notions.filled is what record_quiz_attempt() actually updates —
// subjects.mastery_pct is not written to anywhere yet.
export function subjectMasteryPct(subject, notions) {
  const own = notions.filter((n) => n.subject_id === subject.id);
  if (own.length === 0) return 0;
  const avgFilled = own.reduce((sum, n) => sum + n.filled, 0) / own.length;
  return Math.round((avgFilled / 5) * 100);
}
