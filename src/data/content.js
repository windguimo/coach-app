// Shared sample content for the Coach prototype — mirrors the fixtures used
// in the Claude Design mockups (Coach — Explorations desktop/mobile).

export const USER = { name: "Camille M.", initials: "CM" };

export const SUBJECTS = [
  { id: "negociation", label: "Négociation", labelLong: "Négociation commerciale", pct: 38, tone: "accent" },
  { id: "prise-de-parole", label: "Prise de parole", labelLong: "Prise de parole", pct: 64, tone: "neutral" },
  { id: "sql", label: "SQL analytique", labelLong: "SQL analytique", pct: 12, tone: "neutral" },
];

export const TODAY_SESSION = {
  subject: "Négociation commerciale",
  moduleLine: "Module 3 sur 8 — Ancrer un prix",
  minutes: 15,
  streakDays: 12,
  tasks: [
    { icon: "book-open", label: "Cours", detail: "L'effet d'ancrage · 6 min" },
    { icon: "check-square", label: "Quiz", detail: "6 questions · 5 min" },
    { icon: "microphone", label: "Mise en pratique", detail: "1 cas · 4 min" },
  ],
};

// Mon → Dim. `state` is "done" | "today" | "upcoming" | "off".
export const WEEK = [
  { day: "Lun", date: 1, state: "done", label: "Ancrage" },
  { day: "Mar", date: 2, state: "done", label: "Objections" },
  { day: "Mer", date: 3, state: "today", label: "Ancrer un prix" },
  { day: "Jeu", date: 4, state: "upcoming", label: "Prise de parole", minutes: 15 },
  { day: "Ven", date: 5, state: "upcoming", label: "SQL — jointures", minutes: 15 },
  { day: "Sam", date: 6, state: "off", label: "Révision libre" },
  { day: "Dim", date: 7, state: "off", label: "Repos" },
];

export const UPCOMING_REVIEWS = [
  { when: "Demain", title: "Clôture et engagement — 3 cartes", subject: "Négociation" },
  { when: "Vendredi", title: "Jointures externes — 4 cartes", subject: "SQL analytique" },
  { when: "Samedi", title: "Structurer une intro — 2 cartes", subject: "Prise de parole" },
];

export const LEVEL = {
  level: 4,
  title: "Praticien confirmé",
  xp: 1240,
  xpToNext: 360,
  progressPct: 72,
};

// 24-cell attendance heatmap; `null` renders an empty (未活动) cell.
export const ATTENDANCE = [
  0.6, 0.3, 0.9, null, 0.6, 0.9, 0.9, 0.3, 0.9, 0.9, null, 0.6, 0.9, 0.6, 0.9, 1, 0.3, 0.6, 0.9, 0.9, null, 0.9, 1, 1,
];

export const MASTERY = [
  { notion: "Ancrage de prix", level: "solide", filled: 4 },
  { notion: "Gestion des objections", level: "en cours", filled: 2 },
  { notion: "Clôture et engagement", level: "à revoir", filled: 1 },
  { notion: "Requêtes SQL imbriquées", level: "démarré", filled: 1 },
];

export const MILESTONES_DASHBOARD = [
  { icon: "flame", label: "10 jours", reached: true },
  { icon: "target", label: "Sans faute", reached: true },
  { icon: "mountains", label: "1 sujet", reached: false },
];

export const MILESTONES_PROGRESS = [
  { icon: "flame", label: "10 jours d'affilée", reached: true },
  { icon: "target", label: "Quiz sans faute", reached: true },
  { icon: "mountains", label: "1 sujet terminé", reached: false },
];

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

export const QUIZ_QUESTIONS = [
  {
    prompt: "Un prospect annonce un budget très inférieur à votre prix. Quel premier réflexe ?",
    options: [
      "Baisser de 10 % pour rester dans la course",
      "Demander comment ce budget a été construit",
      "Proposer tout de suite une offre allégée",
      "Reporter la discussion à plus tard",
    ],
    correct: 1,
    why: "Comprendre l'origine du chiffre avant d'y répondre : vous gagnez de l'information et vous ne concédez rien. La remise est toujours disponible plus tard, l'information non.",
  },
  {
    prompt: "Vous devez annoncer votre prix en premier. Qu'est-ce qui protège le mieux votre marge ?",
    options: [
      "Annoncer une fourchette large",
      "Annoncer un prix haut, précis et justifié",
      "Annoncer le prix plancher acceptable",
      "Laisser le client proposer un chiffre",
    ],
    correct: 1,
    why: "Un chiffre précis se défend mieux qu'un chiffre rond : il signale un calcul, pas une posture. C'est l'ancrage qui cadre la suite de la négociation.",
  },
];

export const COURSE = {
  eyebrow: "Cours · lu en 6 min",
  title: "L'effet d'ancrage",
  paragraphs: [
    "Le premier chiffre énoncé dans une négociation oriente tous ceux qui suivent. Ce n'est pas une question d'autorité : c'est un biais d'estimation. Une fois qu'un montant est posé, l'autre partie raisonne par écart à ce montant plutôt qu'en valeur absolue.",
    "Trois conséquences pratiques : annoncez un chiffre précis plutôt qu'un chiffre rond, puisqu'un montant calculé se défend mieux qu'une posture ; ne répondez jamais immédiatement à une ancre basse, demandez d'abord comment elle a été construite ; et gardez votre marge de concession pour la fin, quand elle achète un engagement.",
  ],
  takeawayLabel: "À retenir",
  takeaway: "Un chiffre précis signale un calcul. Un chiffre rond signale une position — et une position s'attaque.",
  note: "Cours généré pour votre niveau, révisé le 2 septembre",
};
