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
  screens/        # une vue par route : Landing ("/"), Auth, Onboarding, Today,
                  # Session, Révisions, Planning, Profile, Progress,
                  # ResetPassword, Admin (dashboard privé)
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
    installPrompt.js        # détection plateforme/standalone, état PWA
    analytics.js              # tracking first-party (voir section Analytics)
    celebrate.js               # confettis/vibration (quiz, fin de séance)
    demoLesson.js               # client streaming de la démo publique
    pendingTopic.js              # sujet tapé sur la landing → onboarding
  sw.js                   # source du service worker (voir section PWA)

supabase/
  migrations/            # schéma SQL, cumulatif, à appliquer dans l'ordre
                          # (0001…0014 à ce jour — voir chaque fichier pour
                          # ce qu'il ajoute, pas de renumérotation a posteriori)
  functions/
    generate-session/    # Edge Function : génère (ou réutilise) un module de cours
    send-reminders/       # Edge Function : rappel push quotidien (cron)
    demo-lesson/          # Edge Function publique (sans JWT) : démo de la landing
```

## PWA (manifest, service worker, installation)

- Nom de l'app centralisé dans `APP_NAME`/`APP_SHORT_NAME`
  (`src/data/content.js`) — piloté à la fois vers l'UI et vers le manifest
  (`vite.config.js` les importe). Changer le nom là, nulle part ailleurs.
- Manifest généré au build par `vite-plugin-pwa` (pas de fichier manifest
  écrit à la main) — voir l'option `manifest` de `VitePWA(...)` dans
  `vite.config.js`. `start_url`/`scope` sont volontairement relatifs
  (`./?source=pwa`, `./`) : le déploiement est sur un sous-chemin GitHub
  Pages avec `HashRouter`, un chemin absolu casserait l'installation.
- Service worker en mode `injectManifest` : `src/sw.js` est la source
  (handlers push/notificationclick + fallback offline), le build y injecte
  le precache de la coquille de l'app (JS/CSS hashés, jamais les requêtes
  Supabase) via `workbox-precaching`. Le fichier servi (`sw.js` à la racine
  du site) est généré — ne pas éditer `dist/sw.js` à la main, toujours
  passer par `src/sw.js`.
- Icônes provisoires (initiale sur fond uni) dans `public/icons/` —
  générées par capture d'écran d'un HTML minimal, pas dessinées à la main ;
  à remplacer telles quelles au rebranding.
- `useInstallPrompt` (src/hooks/) décide, une fois par montage, si la
  bannière d'installation doit s'afficher (première séance faite via
  `profile.streak_days`, pas déjà standalone, budget anti-fatigue —
  3 refus max espacés de 3 jours, stocké en `localStorage` car c'est une
  préférence par appareil, pas par compte) puis fige la décision : ne pas
  la re-dériver à chaque render, `shouldShowInstallPrompt()` bascule à
  "non" dès qu'elle est enregistrée comme affichée.
- `app_events` (migration 0011, étendue en 0013) journalise le funnel
  d'installation + permissions push — voir section Analytics.

## Déploiement — piège à connaître

Seul le **frontend** (GitHub Pages) se redéploie automatiquement au push sur
`main`. Les deux morceaux backend sont **manuels** et il faut toujours penser
aux deux après avoir touché au schéma ou à une Edge Function :

- **Migrations SQL** : si une session Claude a l'outil MCP Supabase connecté
  (`mcp__Supabase__apply_migration`, projet `xrmjhsgeipshejfwdklh`), l'utiliser
  directement — plus fiable que le copier-coller. Sinon (ou pour un humain),
  coller le contenu du nouveau fichier dans le SQL Editor du dashboard
  Supabase et l'exécuter. Les migrations 0001-0010 ont été appliquées à la
  main donc n'apparaissent pas dans `list_migrations` — seules celles passées
  par `apply_migration` (0011 et suivantes) y sont trackées ; ça n'a pas
  d'incidence, juste une explication si le tracking semble incomplet.
- **Edge Functions** (`generate-session`, `send-reminders`, `demo-lesson`) : redéployer avec
  `npx supabase functions deploy <nom-de-la-fonction>` depuis la racine du
  repo (après `npx supabase login` puis `npx supabase link --project-ref
  xrmjhsgeipshejfwdklh`, une fois par machine), ou via
  `mcp__Supabase__deploy_edge_function` (utilisé avec succès pour
  `demo-lesson`). `demo-lesson` doit rester **sans vérification JWT**
  (`--no-verify-jwt` en CLI, `verify_jwt: false` en MCP) — sinon la démo
  renvoie 401 aux visiteurs.

Oublier l'un des deux après un changement de schéma produit des erreurs
trompeuses : une fonction pas redéployée qui référence une colonne/relation
supprimée par une migration donne une erreur PostgREST ("Could not find the
'x' column/relationship...") qui ressemble à un problème de schéma alors que
le vrai problème est juste que le code déployé est resté en retard sur la
base. Si ce genre d'erreur apparaît après une migration qui touchait des
tables lues par une Edge Function, vérifier en premier si cette fonction a
bien été redéployée depuis.

**Le projet Supabase `windguimo's Project` n'est pas dédié à coach-app** :
`list_tables` y montre aussi `companies`/`documents`/`analyses`, un schéma
sans rapport (analyse de dossiers d'entreprise) — vraisemblablement un autre
projet partageant le même compte/projet Supabase. Ne pas y toucher, et ne
pas s'étonner de les voir dans un `list_tables`.

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

## Auth : e-mails de confirmation et liens de retour

Confirmation d'e-mail activée : `signUp` ne renvoie pas de session, l'écran
d'inscription bascule alors sur « Vérifiez votre boîte mail » (avec renvoi
du lien). Tous les liens d'e-mail passent `emailRedirectTo` /
`redirectTo` = `authRedirectTo(...)` (`https://windguimo.github.io/coach-app/#/…`).
**Côté Supabase (dashboard, pas de MCP pour ça)** : Authentication → URL
Configuration → Site URL = `https://windguimo.github.io/coach-app/` et
Redirect URLs contenant `https://windguimo.github.io/coach-app/**` — sinon
Supabase ignore le redirect et renvoie vers le Site URL (il pointait sur
`https://windguimo.github.io/`, d'où une 404). Le retour de lien est lu
par `src/lib/authReturn.js` (`?code=` PKCE, ou `error_code` en query/hash) :
si l'échange échoue (lien ouvert dans un autre navigateur, lien expiré),
l'écran de connexion affiche un message adapté au lieu d'une page vide.

## Landing publique + démo live

"/" affiche `LandingScreen` à tout visiteur déconnecté, y compris dans la PWA
installée et après déconnexion (connecté → /today ; toute route inconnue → "/").
Le visiteur tape un sujet : l'Edge Function
`demo-lesson` stream un mini-cours + 1 question en texte brut à format
lignes (`TITRE:`, `§`, `RETENIR:`, `QUESTION:`, `A)`…`D)`, `REPONSE:`,
`EXPLICATION:`, ou `REFUS:`), parsé côté client (`src/lib/demoLesson.js`)
et affiché en machine à écrire. Fonction **ouverte sans JWT** — coût borné
par : cache `demo_lessons` par `slugify_topic` (rejoué gratuitement),
3 générations/IP hashée/24 h et 200/24 h au global (`demo_requests`,
migration 0012, RLS sans policy = service-role uniquement). Contenu démo
volontairement séparé de `content_library`. Le CTA mémorise le sujet
(`pendingTopic.js`, localStorage) et `useOnboarding` le pré-sélectionne.

## Analytics + dashboard admin

Tracking **first-party**, sans outil tiers : tout va dans `app_events`
via `track(event, props)` (`src/lib/analytics.js`, fire-and-forget).
Chaque événement porte `anon_id` (id aléatoire par appareil en
localStorage, identique avant/après inscription → relie tout le parcours),
`session_id` (une visite, renouvelée après 30 min d'inactivité), `path`,
`platform`, `props`, et `user_id` (défaut `auth.uid()`, null pour un
visiteur déconnecté — insert anonyme autorisé par RLS, lecture jamais).
Pas d'IP ni de user agent stockés. Durée de visite = dernier − premier
événement de la session, rendue fiable par un `heartbeat` toutes les 30 s
(onglet visible + interaction < 3 min).

Événements émis : `page_view` (chaque route, avec `ref` = utm_source ou
site d'origine), `heartbeat`, `demo_started/completed/refused/error/
answered`, `signup_cta_clicked`, `signup_completed`, `login_completed`,
`auth_error`, `onboarding_completed/error`, `session_ready` (temps de
génération), `session_error`, `session_started/answer/completed`
(`props.module_id` relie une séance), `revision_answer`, + les
événements PWA/push existants. En ajouter un : appeler `track()` puis, si
le dashboard doit l'afficher, l'ajouter à `analytics_dashboard()` dans une
**nouvelle** migration et à `EVENT_LABELS` dans `AdminScreen.jsx`.

Dashboard : `/admin` (lien dans Profil, visible seulement si `is_admin()`).
Tout vient d'une RPC, `admin_dashboard(p_days, p_include_admin)`, qui
vérifie `public.admins` puis appelle `analytics_dashboard(...)`. L'usage
des admins (leurs comptes + tous les appareils qu'ils ont utilisés) est
exclu par défaut. Ajouter un admin : `insert into public.admins (user_id)
select id from auth.users where email = '…'` (à la main, jamais dans une
migration). **Pour analyser les stats avec l'utilisateur**, interroger
directement via MCP : `select public.analytics_dashboard(30)` (non exposée
aux clients, accessible en SQL), ou `app_events` en SQL libre pour des
questions plus fines.

## Coûts LLM

Chaque appel Anthropic (`generate-session`, `demo-lesson`) écrit une ligne
dans `llm_usage` (migration 0014) : tokens lus/écrits/cache issus du
`usage` de l'API, durée, succès. `cost_usd` est calculé **à l'insertion**
par un trigger depuis `llm_prices` (USD / million de tokens) : un
changement de tarif = un `update llm_prices`, sans redéploiement, et les
lignes passées gardent le prix payé. **Si une nouvelle fonction appelle
Claude ou si le modèle change**, y ajouter le même log et insérer la ligne
de prix du modèle (sinon coût = 0). Agrégats : `llm_costs(days)` (SQL
seulement), fusionné dans `admin_dashboard` sous la clé `llm` (section
« Coûts IA » du dashboard). Les appels antérieurs au 7 oct. 2026 ne sont
pas mesurés. Ordre de grandeur constaté : une démo ≈ 0,008 $.

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
