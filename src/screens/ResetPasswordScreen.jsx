import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { supabase } from "../lib/supabaseClient";
import "./AuthScreen.css";

export function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate("/today", { replace: true });
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

        <h1 className="auth-title">Nouveau mot de passe</h1>
        <p className="auth-subtitle">Choisissez un mot de passe pour votre compte.</p>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-field">
            <span>Mot de passe</span>
            <input
              type="password"
              required
              minLength={6}
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="btn-accent" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "Un instant…" : "Mettre à jour"}
            <Icon name="arrow-right" size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
