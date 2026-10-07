import { useCallback, useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { supabase } from "../lib/supabaseClient";
import "./AdminScreen.css";

// Private product dashboard — every figure comes from one RPC,
// admin_dashboard(days, include_admin) (migration 0013), which refuses
// non-admins server-side. Claude reads the same numbers directly via
// analytics_dashboard() in SQL, so what's shown here and what gets
// analyzed together always agree.

const PERIODS = [
  { days: 1, label: "24 h" },
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
];

const nf = new Intl.NumberFormat("fr-FR");
const fmt = (n) => (n == null ? "—" : nf.format(n));
const pct = (n) => (n == null ? "—" : `${n} %`);

function duration(secs) {
  if (secs == null) return "—";
  const s = Math.round(secs);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, "0")}`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

function relative(iso) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

const PLATFORM_LABELS = { ios: "iPhone / iPad", android: "Android", desktop: "Ordinateur", "other-mobile": "Autre mobile" };

const EVENT_LABELS = {
  page_view: (e) => `a ouvert ${e.path === "/" ? "la page d'accueil" : e.path}`,
  demo_started: (e) => `a lancé la démo « ${e.props?.topic ?? "?"} »`,
  demo_completed: () => "a vu son cours de démo",
  demo_refused: (e) => `démo refusée (« ${e.props?.topic ?? "?"} »)`,
  demo_error: (e) => `erreur démo (${e.props?.code ?? "?"})`,
  demo_answered: (e) => (e.props?.correct ? "a réussi la question de démo" : "a raté la question de démo"),
  signup_cta_clicked: () => "a cliqué sur « Créer mon compte »",
  signup_completed: () => "a créé son compte",
  login_completed: () => "s'est connecté",
  auth_error: (e) => `erreur de connexion (${e.props?.mode ?? ""})`,
  password_reset_requested: () => "a demandé un nouveau mot de passe",
  onboarding_completed: (e) =>
    e.props?.first_time ? `a terminé l'onboarding (${(e.props?.subjects ?? []).join(", ")})` : "a modifié ses sujets",
  onboarding_error: () => "erreur à l'onboarding",
  session_ready: (e) => `séance générée en ${duration((e.props?.ms ?? 0) / 1000)}`,
  session_error: () => "erreur de génération de séance",
  session_started: () => "a ouvert une séance",
  session_answer: (e) =>
    `a répondu à la question ${(e.props?.qi ?? 0) + 1}/${e.props?.total ?? "?"} ${e.props?.correct ? "✓" : "✗"}`,
  session_completed: (e) => `a terminé une séance (${e.props?.correct ?? "?"}/${e.props?.total ?? "?"})`,
  revision_answer: (e) => `révision ${e.props?.correct ? "✓" : "✗"}`,
  install_prompt_shown: () => "a vu la proposition d'installation",
  install_prompt_accepted: () => "a accepté d'installer l'app",
  install_prompt_dismissed: () => "a refusé d'installer l'app",
  app_installed: () => "a installé l'app",
  app_opened_standalone: () => "a ouvert l'app installée",
  push_permission_granted: () => "a activé les notifications",
  push_permission_denied: () => "a refusé les notifications",
};

function describe(e) {
  return EVENT_LABELS[e.event]?.(e) ?? e.event;
}

function useDashboard(days, includeAdmin) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: result, error: err } = await supabase.rpc("admin_dashboard", {
      p_days: days,
      p_include_admin: includeAdmin,
    });
    if (err) setError(err.code === "42501" ? "forbidden" : err.message);
    else {
      setError(null);
      setData(result);
    }
    setLoading(false);
  }, [days, includeAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export function AdminScreen() {
  const [days, setDays] = useState(7);
  const [includeAdmin, setIncludeAdmin] = useState(false);
  const { data, loading, error, reload } = useDashboard(days, includeAdmin);

  if (error === "forbidden") {
    return (
      <div className="admin-screen">
        <h1 className="admin-title">Accès réservé</h1>
        <p className="admin-muted">Ce tableau de bord est réservé aux administrateurs.</p>
      </div>
    );
  }

  const k = data?.kpis ?? {};

  return (
    <div className="admin-screen">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Tableau de bord</h1>
          <p className="admin-muted">
            {data ? `Mis à jour ${relative(data.generated_at)}` : "Chargement…"}
            {!includeAdmin && " · ton propre usage est exclu"}
          </p>
        </div>
        <button className="admin-refresh" onClick={reload} disabled={loading} aria-label="Actualiser">
          <Icon name="arrow-clockwise" size={16} />
        </button>
      </header>

      <div className="admin-filters" role="group" aria-label="Période">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            className={`admin-chip${days === p.days ? " admin-chip--on" : ""}`}
            aria-pressed={days === p.days}
            onClick={() => setDays(p.days)}
          >
            {p.label}
          </button>
        ))}
        <label className="admin-toggle">
          <input type="checkbox" checked={includeAdmin} onChange={(e) => setIncludeAdmin(e.target.checked)} />
          Inclure mon usage
        </label>
      </div>

      {error && <p className="admin-error">Erreur : {error}</p>}

      {data && (
        <div className={`admin-body${loading ? " admin-body--loading" : ""}`}>
          <section className="admin-kpis">
            <Kpi label="Visiteurs uniques" value={fmt(k.visitors)} hint={`dont ${fmt(k.new_visitors)} nouveaux · ${fmt(k.visits)} visites`} />
            <Kpi label="Inscriptions" value={fmt(k.signups)} hint={`${fmt(k.total_users)} comptes au total`} />
            <Kpi label="Utilisateurs actifs" value={fmt(k.active_users)} hint="connectés sur la période" />
            <Kpi label="Séances terminées" value={fmt(k.sessions_completed)} hint={`${fmt(k.questions_answered)} réponses · ${pct(k.accuracy_pct)} justes`} />
            <Kpi label="Temps par visite" value={duration(k.avg_visit_secs)} hint={`médiane ${duration(k.median_visit_secs)} · ${fmt(k.total_minutes)} min au total`} />
            <Kpi label="Reviennent le lendemain" value={pct(k.back_d1_pct)} hint={`${pct(k.returning_pct)} actifs ≥ 2 jours`} />
          </section>

          <section className="admin-minis">
            <Mini label="Rebond (< 10 s)" value={pct(k.bounce_pct)} />
            <Mini label="App installée" value={fmt(k.installed)} />
            <Mini label="Notifications activées" value={fmt(k.push_users)} />
            <Mini label="Générations Claude (démo)" value={fmt(k.claude_demo_generations)} />
            <Mini label="Générations Claude (séances)" value={fmt(k.claude_session_generations)} />
            <Mini label="Erreurs de génération" value={fmt(k.session_errors)} />
            <Mini label="Génération d'une séance" value={k.avg_generation_ms ? duration(k.avg_generation_ms / 1000) : "—"} />
          </section>

          <Card title="Jour par jour">
            <div className="admin-daily">
              <Columns title="Visiteurs" rows={data.daily} field="visitors" />
              <Columns title="Inscriptions" rows={data.daily} field="signups" />
              <Columns title="Utilisateurs actifs" rows={data.daily} field="active_users" />
              <Columns title="Séances terminées" rows={data.daily} field="sessions_completed" />
            </div>
            <DailyTable rows={data.daily} />
          </Card>

          <div className="admin-grid">
            <Card title="Parcours visiteur" subtitle="Appareils distincts ayant atteint chaque étape">
              <Funnel steps={data.visitor_funnel} />
            </Card>
            <Card title="Parcours des inscrits" subtitle="Comptes créés sur la période, jusqu'où ils sont allés">
              <Funnel steps={data.account_funnel} />
            </Card>
          </div>

          <div className="admin-grid">
            <Card title="Abandons de séance" subtitle="Séances ouvertes mais pas terminées">
              <Abandonment a={data.abandonment} />
            </Card>
            <Card title="Sujets tapés dans la démo">
              <BarList rows={data.demo_topics} label={(r) => r.topic} empty="Aucune démo lancée sur la période." />
              {data.demo_errors.length > 0 && (
                <p className="admin-muted admin-note">
                  Erreurs : {data.demo_errors.map((e) => `${e.code} (${e.count})`).join(", ")}
                </p>
              )}
            </Card>
          </div>

          <div className="admin-grid">
            <Card title="Appareils">
              <BarList rows={data.platforms} label={(r) => PLATFORM_LABELS[r.platform] ?? r.platform} empty="Pas encore de données." />
            </Card>
            <Card title="Provenance" subtitle="?utm_source= du lien partagé, sinon site d'origine">
              <BarList rows={data.sources} label={(r) => (r.source === "direct" ? "Direct / message" : r.source)} empty="Pas encore de données." />
            </Card>
          </div>

          <Card title={`Utilisateurs (${data.users.length})`}>
            <UsersTable users={data.users} />
          </Card>

          <Card title="Activité récente">
            <Feed events={data.recent} />
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <section className="admin-card">
      <h2 className="admin-card__title">{title}</h2>
      {subtitle && <p className="admin-card__subtitle">{subtitle}</p>}
      <div className="admin-card__body">{children}</div>
    </section>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <div className="admin-kpi">
      <div className="admin-kpi__label">{label}</div>
      <div className="admin-kpi__value">{value}</div>
      {hint && <div className="admin-kpi__hint">{hint}</div>}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="admin-mini">
      <span className="admin-mini__value">{value}</span>
      <span className="admin-mini__label">{label}</span>
    </div>
  );
}

const dayLabel = (d, opts = { day: "numeric", month: "short" }) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", opts);

// One small single-series column chart per metric (small multiples, one
// shared x, no dual axis). Each column is its own hover/focus target.
function Columns({ title, rows, field }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...rows.map((r) => r[field]));
  const total = rows.reduce((s, r) => s + r[field], 0);
  const shown = hover != null ? rows[hover] : null;

  return (
    <div className="admin-cols">
      <div className="admin-cols__head">
        <span>{title}</span>
        <span className="admin-cols__readout">
          {shown ? (
            <>
              <strong>{fmt(shown[field])}</strong> · {dayLabel(shown.day, { weekday: "short", day: "numeric", month: "short" })}
            </>
          ) : (
            <>
              <strong>{fmt(total)}</strong> au total
            </>
          )}
        </span>
      </div>
      <div className="admin-cols__plot" onPointerLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <div
            key={r.day}
            className={`admin-cols__hit${hover === i ? " admin-cols__hit--on" : ""}`}
            tabIndex={0}
            aria-label={`${dayLabel(r.day)} : ${r[field]}`}
            onPointerEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <div className="admin-cols__bar" style={{ height: `${(r[field] / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="admin-cols__axis">
        <span>{dayLabel(rows[0].day)}</span>
        {rows.length > 1 && <span>{dayLabel(rows[rows.length - 1].day)}</span>}
      </div>
    </div>
  );
}

function DailyTable({ rows }) {
  return (
    <details className="admin-details">
      <summary>Voir le tableau</summary>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Jour</th>
              <th>Visiteurs</th>
              <th>Inscriptions</th>
              <th>Actifs</th>
              <th>Séances</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.day}>
                <td>{dayLabel(r.day, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td>{r.visitors}</td>
                <td>{r.signups}</td>
                <td>{r.active_users}</td>
                <td>{r.sessions_completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// Ordered stages → one hue; each row says how many reached the stage, the
// share of the first stage, and how many were lost since the previous one.
function Funnel({ steps }) {
  const first = steps[0]?.count ?? 0;
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <ol className="admin-funnel">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const lost = prev != null && prev > s.count ? prev - s.count : 0;
        return (
          <li key={s.label} className="admin-funnel__row">
            <div className="admin-funnel__line">
              <span className="admin-funnel__label">{s.label}</span>
              <span className="admin-funnel__count">
                <strong>{fmt(s.count)}</strong>
                {i > 0 && first > 0 && <span className="admin-muted"> · {Math.round((s.count / first) * 100)} %</span>}
              </span>
            </div>
            <div className="admin-track">
              <div className="admin-track__fill" style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
            {lost > 0 && <div className="admin-funnel__lost">−{fmt(lost)} depuis l'étape précédente</div>}
          </li>
        );
      })}
    </ol>
  );
}

function Abandonment({ a }) {
  if (!a.started) return <p className="admin-muted">Aucune séance ouverte sur la période.</p>;
  const done = Math.round((a.completed / a.started) * 100);
  return (
    <div>
      <div className="admin-funnel__line">
        <span>
          <strong>{fmt(a.completed)}</strong> terminées sur <strong>{fmt(a.started)}</strong> ouvertes
        </span>
        <span>
          <strong>{done} %</strong>
        </span>
      </div>
      <div className="admin-track">
        <div className="admin-track__fill" style={{ width: `${done}%` }} />
      </div>
      {a.quit_after.length > 0 && (
        <>
          <p className="admin-card__subtitle" style={{ marginTop: 16 }}>
            Arrêtées après…
          </p>
          <BarList rows={a.quit_after} label={(r) => (r.answered === 0 ? "0 réponse (dès le cours)" : `${r.answered} réponse${r.answered > 1 ? "s" : ""}`)} />
        </>
      )}
    </div>
  );
}

function BarList({ rows, label, empty }) {
  if (!rows.length) return <p className="admin-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="admin-barlist">
      {rows.map((r, i) => (
        <li key={i}>
          <div className="admin-funnel__line">
            <span className="admin-barlist__label">{label(r)}</span>
            <strong>{fmt(r.count)}</strong>
          </div>
          <div className="admin-track admin-track--thin">
            <div className="admin-track__fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function UsersTable({ users }) {
  if (!users.length) return <p className="admin-muted">Aucun utilisateur pour l'instant.</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>Inscrit</th>
            <th>Vu</th>
            <th>Jours actifs</th>
            <th>Séances</th>
            <th>Réponses</th>
            <th>Justes</th>
            <th>Série</th>
            <th>Temps</th>
            <th>Appareil</th>
            <th>Notifs</th>
            <th>Sujets</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div className="admin-user">{u.name}</div>
                <div className="admin-muted">{u.email}</div>
              </td>
              <td>{dayLabel(u.created_at.slice(0, 10))}</td>
              <td>{relative(u.last_seen)}</td>
              <td>{u.active_days}</td>
              <td>{u.modules}</td>
              <td>{u.answers}</td>
              <td>{pct(u.accuracy)}</td>
              <td>{u.streak}</td>
              <td>{u.minutes ? `${u.minutes} min` : "—"}</td>
              <td>{PLATFORM_LABELS[u.platform] ?? "—"}</td>
              <td>{u.push ? "Oui" : "Non"}</td>
              <td className="admin-table__subjects">{u.subjects ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Feed({ events }) {
  if (!events.length) return <p className="admin-muted">Rien sur la période.</p>;
  return (
    <ul className="admin-feed">
      {events.map((e, i) => (
        <li key={i} className="admin-feed__row">
          <span className="admin-feed__time">
            {new Date(e.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span>
            <strong>{e.who}</strong> {describe(e)}
          </span>
        </li>
      ))}
    </ul>
  );
}
