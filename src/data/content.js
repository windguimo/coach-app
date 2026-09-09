// Onboarding suggestions only — everything else (subjects, plan, course
// content, quiz, progress) now comes from Supabase (see src/hooks/) and, for
// course/quiz content, the generate-session Edge Function backed by Claude.

export const ONBOARDING_TOPICS = [
  "Négociation commerciale",
  "Prise de parole",
  "SQL analytique",
  "Anglais professionnel",
  "Management d'équipe",
  "Gestion du temps",
  "Finance d'entreprise",
  "Product discovery",
  "Design d'interface",
];

export const ONBOARDING_PACES = ["10 min", "15 min", "25 min", "40 min"];

// Per-subject weekly frequency, editable from Profile — 7 (every active day)
// is the default so a fresh subject shows up daily until you dial it down.
export const SESSION_FREQUENCIES = [
  { value: 7, label: "Tous les jours" },
  { value: 5, label: "5x / semaine" },
  { value: 3, label: "3x / semaine" },
  { value: 2, label: "2x / semaine" },
  { value: 1, label: "1x / semaine" },
];
