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
