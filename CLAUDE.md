# coach-app

App de coaching quotidien : l'utilisateur choisit des sujets à l'onboarding,
puis reçoit chaque jour un mini-cours + quiz de 2 questions généré par
Claude pour un "module" de son sujet. Progression suivie via XP, séries
(streak) et maîtrise par notion.

## Stack

- **Frontend** : React + Vite, déployé sur GitHub Pages.
- **Backend** : Supabase (Postgres + Auth + Row Level Security + Edge
  Functions), déployé sur Supabase Edge Functions.
- **Génération de contenu** : Anthropic Claude (`claude-sonnet-5`), appelé
  uniquement depuis l'Edge Function `generate-session` — la clé API
  n'atteint jamais le client.

## Structure

```
src/
  screens/        # une vue par route : Auth, Onboarding, Today, Session, Progress
  hooks/          # tout l'accès Supabase passe par des hooks (use*.js)
  components/     # composants partagés (AppShell, Sidebar, BottomTabBar…)
  data/content.js # listes statiques (sujets suggérés à l'onboarding, rythmes)
  lib/
    supabaseClient.js  # client Supabase (anon key)
    auth.jsx            # contexte d'authentification
    mastery.js           # calculs de progression côté client

supabase/
  migrations/            # schéma SQL, à appliquer dans l'ordre (0001, 0002…)
  functions/
    generate-session/    # Edge Function : génère (ou réutilise) un module de cours
```

## Modèle de données (points clés)

- `subjects`, `notions`, `plan_days`, `activity_log`, `milestones`,
  `quiz_attempts` : données **par utilisateur**, RLS "all own"
  (`auth.uid() = user_id`).
- `content_library` / `content_library_questions` : cache de contenu
  **partagé entre tous les utilisateurs**, clé par
  `(topic_slug, module_index)` où `topic_slug` normalise le libellé libre du
  sujet (minuscules, sans accents/ponctuation — voir
  `supabase/migrations/0002_shared_content_library.sql`). Lecture ouverte à
  tout utilisateur authentifié ; écriture uniquement via le client
  service-role de l'Edge Function.
- `course_modules` : pointeur **par utilisateur** vers `content_library`
  (quel module l'utilisateur en est, quelle notion ça alimente) — ne
  contient plus le texte du cours lui-même.
- RPC Postgres notables : `apply_onboarding` (fixe les sujets + planning
  d'un utilisateur), `record_quiz_attempt` (scoring serveur, XP, streak,
  maîtrise des notions — jamais fait côté client), `slugify_topic`
  (normalisation de sujet).

## Flux de génération de session

`useGeneratedSession` (src/hooks/useGeneratedSession.js) appelle l'Edge
Function `generate-session`, qui :
1. authentifie l'utilisateur via son JWT,
2. calcule le `module_index` suivant pour ce sujet **pour cet utilisateur**,
3. vérifie si ce module existe déjà pour lui (clic dupliqué),
4. sinon, cherche le contenu dans le cache partagé `content_library` par
   `(topic_slug, module_index)`,
5. seulement en cas d'échec du cache, appelle Claude et écrit le résultat
   dans le cache partagé,
6. crée le pointeur `course_modules` de l'utilisateur vers ce contenu.

C'est le levier principal d'économie de coûts : le coût Anthropic scale
avec (sujets uniques × modules), pas (utilisateurs × modules).

## Conventions

- Toute la logique métier sensible (scoring, XP, streak, maîtrise) vit dans
  des RPC Postgres `security definer`, jamais calculée côté client.
- Les migrations sont numérotées et cumulatives — ne pas modifier une
  migration déjà appliquée en prod, en ajouter une nouvelle.
- Le contenu généré est toujours en français (voir le system prompt dans
  `generate-session/index.ts`).
