import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { supabase } from "../lib/supabaseClient";
import "./AuthScreen.css";

export function AuthScreen() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/today";

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split("@")[0] } },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
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

        <h1 className="auth-title">{mode === "login" ? "Content de vous revoir." : "Créez votre compte."}</h1>
        <p className="auth-subtitle">
          {mode === "login" ? "Reprenez votre rythme là où vous l'avez laissé." : "Quinze minutes par jour, et vous progressez."}
        </p>

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

          {error && <div className="auth-error">{error}</div>}

          <button className="btn-accent" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "Un instant…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
            <Icon name="arrow-right" size={15} />
          </button>
        </form>

        <button className="auth-switch" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Pas encore de compte ? Inscrivez-vous" : "Déjà un compte ? Connectez-vous"}
        </button>
      </div>
    </div>
  );
}
