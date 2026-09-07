import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { authRedirectTo, supabase } from "../lib/supabaseClient";
import "./AuthScreen.css";

export function AuthScreen() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/today";

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: authRedirectTo("/reset-password"),
        });
        if (err) throw err;
        setInfo("Email envoyé — cliquez sur le lien qu'il contient pour choisir un nouveau mot de passe.");
      } else if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split("@")[0] } },
        });
        if (err) throw err;
        navigate(from, { replace: true });
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const withGoogle = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectTo("/today") },
    });
    if (err) setError(err.message);
  };

  const titles = {
    login: ["Content de vous revoir.", "Reprenez votre rythme là où vous l'avez laissé."],
    signup: ["Créez votre compte.", "Quinze minutes par jour, et vous progressez."],
    forgot: ["Mot de passe oublié ?", "Indiquez votre email, on vous envoie un lien pour le réinitialiser."],
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand__mark">
            <Icon name="compass" size={16} />
          </span>
          <span className="auth-brand__name">Coach</span>
        </div>

        <h1 className="auth-title">{titles[mode][0]}</h1>
        <p className="auth-subtitle">{titles[mode][1]}</p>

        {mode !== "forgot" && (
          <>
            <button className="auth-google" onClick={withGoogle} type="button">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              Continuer avec Google
            </button>
            <div className="auth-divider">
              <span />
              ou
              <span />
            </div>
          </>
        )}

        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label className="auth-field">
              <span>Prénom</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Camille" />
            </label>
          )}
          <label className="auth-field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" />
          </label>
          {mode !== "forgot" && (
            <label className="auth-field">
              <span>Mot de passe</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          )}
          {mode === "login" && (
            <button type="button" className="auth-forgot" onClick={() => { setMode("forgot"); setError(null); setInfo(null); }}>
              Mot de passe oublié ?
            </button>
          )}

          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}

          <button className="btn-accent" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "Un instant…" : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien"}
            <Icon name="arrow-right" size={15} />
          </button>
        </form>

        <button
          className="auth-switch"
          onClick={() => {
            setError(null);
            setInfo(null);
            setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup");
          }}
        >
          {mode === "signup" ? "Déjà un compte ? Connectez-vous" : mode === "forgot" ? "Retour à la connexion" : "Pas encore de compte ? Inscrivez-vous"}
        </button>
      </div>
    </div>
  );
}
