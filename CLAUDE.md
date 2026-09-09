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
  screens/        # une vue par route : Auth, Onboarding, Today, Session,
                  # Révisions, Planning, Profile, Progress, ResetPassword
  hooks/          # tout l'accès Supabase passe par des hooks (use*.js)
  components/     # composants partagés (AppShell, Sidebar, BottomTabBar,
                  # QuizOptions — partagé entre Session et Révisions…)
  data/content.js # listes statiques (sujets suggérés à l'onboarding, rythmes)
  lib/
    supabaseClient.js  # client Supabase (anon key)
    auth.jsx            # contexte d'authentification
    mastery.js           # calculs de progression côté client
    push.js               # abonnement Web Push (rappels quotidiens)
    ics.js                 # export .ics des séances à venir

supabase/
  migrations/            # schéma SQL, cumulatif, à appliquer dans l'ordre
                          # (0001…0008 à ce jour — voir chaque fichier pour
                          # ce qu'il ajoute, pas de renumérotation a posteriori)
  functions/
    generate-session/    # Edge Function : génère (ou réutilise) un module de cours
    send-reminders/       # Edge Function : rappel push quotidien (cron)
```

## Déploiement — piège à connaître

Seul le **frontend** (GitHub Pages) se redéploie automatiquement au push sur
`main`. Les deux morceaux backend sont **manuels** et il faut toujours penser
aux deux après avoir touché au schéma ou à une Edge Function :

- **Migrations SQL** : coller le contenu du nouveau fichier dans le SQL
  Editor du dashboard Supabase et l'exécuter (pas de CLI/CI branché).
- **Edge Functions** (`generate-session`, `send-reminders`) : redéployer avec
  `npx supabase functions deploy <nom-de-la-fonction>` depuis la racine du
  repo (après `npx supabase login` puis `npx supabase link --project-ref
  xrmjhsgeipshejfwdklh`, une fois par machine).

Oublier l'un des deux après un changement de schéma produit des erreurs
trompeuses : une fonction pas redéployée qui référence une colonne/relation
supprimée par une migration donne une erreur PostgREST ("Could not find the
'x' column/relationship...") qui ressemble à un problème de schéma alors que
le vrai problème est juste que le code déployé est resté en retard sur la
base. Si ce genre d'erreur apparaît après une migration qui touchait des
tables lues par une Edge Function, vérifier en premier si cette fonction a
bien été redéployée depuis.

## Modèle de données (points clés)

- `subjects`, `notions`, `plan_days`, `activity_log`, `milestones`,
  `quiz_attempts` : données **par utilisateur**, RLS "all own"
  (`auth.uid() = user_id`).
- `content_library` / `content_library_questions` : cache de contenu
  **partagé entre tous les utilisateurs**, clé par
  `(topic_slug, module_index)` où `topic_slug` normalise le libellé libre du
  sujet (minuscules, sans accents/ponctuation — voir
  `supabase/migrations/0007_shared_content_library.sql`). Lecture ouverte à
  tout utilisateur authentifié ; écriture uniquement via le client
  service-role de l'Edge Function.
- `course_modules` : pointeur **par utilisateur** vers `content_library`
  (quel module l'utilisateur en est, quelle notion ça alimente) — ne
  contient plus le texte du cours lui-même.
- RPC Postgres notables : `apply_onboarding` (fixe les sujets + planning
  d'un utilisateur, respecte `profiles.active_days`), `ensure_plan_days`
  (fait avancer le planning glissant, réconcilie les jours passés en
  fonction de l'activité réelle), `record_quiz_attempt` (scoring serveur,
  XP, streak, maîtrise des notions — jamais fait côté client),
  `slugify_topic` (normalisation de sujet).
- `push_subscriptions` : un abonnement Web Push par appareil, utilisé par
  l'Edge Function `send-reminders` (déclenchée par cron) pour relancer les
  utilisateurs qui n'ont pas fait leur séance du jour.

## Révisions (pratique gratuite)

`RevisionsScreen` (+ `useReviewQueue.js`) sert une file de questions déjà
générées, pour les notions pas encore "solide", **sans appeler Claude** —
zéro coût, effet répétition espacée. Comme les questions vivent maintenant
dans `content_library_questions` (partagé, sans `user_id`), la requête part
de `course_modules` (pointeur par utilisateur, RLS-scopé) et traverse
`content_library` pour atteindre les questions, puis aplatit le résultat
côté client. Si tu touches au schéma de contenu, vérifie cette requête —
c'est le seul autre endroit (avec `generate-session`) qui lit
`content_library_questions`.

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
