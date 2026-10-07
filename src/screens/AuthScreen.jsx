import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { authRedirectTo, supabase } from "../lib/supabaseClient";
import { APP_NAME } from "../data/content";
import { track } from "../lib/analytics";
import { authReturn, consumeAuthReturnMessage } from "../lib/authReturn";
import "./AuthScreen.css";

export function AuthScreen() {
  const location = useLocation();
  // The landing page sends visitors here with state.mode = "signup".
  const [mode, setMode] = useState(location.state?.mode === "signup" ? "signup" : "login"); // 'login' | 'signup' | 'forgot' | 'check'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  // Back from an email link without a session: say what happened, once.
  const [returnMsg] = useState(consumeAuthReturnMessage);
  const [error, setError] = useState(returnMsg?.type === "error" ? returnMsg.text : null);
  const [info, setInfo] = useState(returnMsg?.type === "info" ? returnMsg.text : null);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false); // login refused: email not confirmed yet
  const [resend, setResend] = useState("idle"); // idle | sending | sent | error
  const navigate = useNavigate();
  // Just confirmed by email (in another browser): next stop is onboarding.
  const from = location.state?.from?.pathname || (authReturn?.kind === "code" && !authReturn.reset ? "/onboarding" : "/today");

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
        track("password_reset_requested");
        setInfo("Email envoyé — cliquez sur le lien qu'il contient pour choisir un nouveau mot de passe.");
      } else if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
            // Where the confirmation link lands. Must be listed in Supabase →
            // Authentication → URL Configuration → Redirect URLs, or
            // Supabase silently falls back to the Site URL.
            emailRedirectTo: authRedirectTo("/onboarding"),
          },
        });
        if (err) throw err;
        track("signup_completed", { needs_confirmation: !data.session });
        if (data.session) navigate(from, { replace: true });
        else setMode("check");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err?.code === "email_not_confirmed" || /not confirmed/i.test(err?.message ?? "")) {
          setUnconfirmed(true);
          throw new Error("Votre adresse n'est pas encore confirmée : cliquez sur le lien reçu par e-mail.");
        }
        if (err) throw err;
        track("login_completed");
        navigate(from, { replace: true });
      }
    } catch (err) {
      track("auth_error", { mode, message: String(err.message).slice(0, 120) });
      setError(frenchAuthError(err.message));
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

  const resendConfirmation = async () => {
    setResend("sending");
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: authRedirectTo("/onboarding") },
    });
    setResend(err ? "error" : "sent");
    track("signup_email_resent", { ok: !err });
  };

  if (mode === "check") {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="auth-brand__mark">
              <Icon name="compass" size={16} />
            </span>
            <span className="auth-brand__name">{APP_NAME}</span>
          </div>
          <div className="auth-mail-icon" aria-hidden="true">
            <Icon name="envelope-simple" size={26} />
          </div>
          <h1 className="auth-title">Vérifiez votre boîte mail.</h1>
          <p className="auth-subtitle">
            Nous avons envoyé un lien de confirmation à <strong>{email}</strong>. Cliquez dessus pour activer votre compte : vous
            arriverez directement sur le choix de vos sujets.
          </p>
          <ul className="auth-tips">
            <li>Le message peut mettre une minute à arriver.</li>
            <li>Pas reçu ? Regardez dans les spams ou les promotions.</li>
            <li>Ouvrez le lien sur ce même appareil pour être connecté directement.</li>
          </ul>
          {resend === "sent" && <div className="auth-info">Nouvel e-mail envoyé.</div>}
          {resend === "error" && <div className="auth-error">L'envoi a échoué. Réessayez dans une minute.</div>}
          <button className="btn-accent" type="button" onClick={resendConfirmation} disabled={resend === "sending" || resend === "sent"} style={{ width: "100%", marginTop: 16 }}>
            {resend === "sending" ? "Envoi…" : resend === "sent" ? "E-mail renvoyé" : "Renvoyer l'e-mail"}
          </button>
          <button
            className="auth-switch"
            onClick={() => {
              setMode("login");
              setError(null);
              setInfo(null);
            }}
          >
            J'ai confirmé mon adresse : me connecter
          </button>
        </div>
      </div>
    );
  }

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
          <span className="auth-brand__name">{APP_NAME}</span>
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
          {unconfirmed && mode === "login" && (
            <button type="button" className="auth-forgot" onClick={resendConfirmation} disabled={resend === "sending" || resend === "sent"}>
              {resend === "sent" ? "Lien de confirmation renvoyé" : "Renvoyer le lien de confirmation"}
            </button>
          )}
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

// Supabase error messages are in English; translate the ones people hit.
function frenchAuthError(message = "") {
  if (/invalid login credentials/i.test(message)) return "E-mail ou mot de passe incorrect.";
  if (/already registered|already been registered/i.test(message))
    return "Un compte existe déjà avec cette adresse. Connectez-vous, ou utilisez « Mot de passe oublié ».";
  if (/password should be at least/i.test(message)) return "Le mot de passe doit faire au moins 6 caractères.";
  if (/rate limit|too many/i.test(message)) return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (/invalid email|unable to validate email/i.test(message)) return "Cette adresse e-mail n'est pas valide.";
  return message;
}
