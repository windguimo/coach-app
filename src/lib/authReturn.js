// What the URL says about a return from a Supabase auth email link (signup
// confirmation, password reset), read once at module load — before the
// router or the Supabase client touch the URL.
//
// - `?code=…` (PKCE): supabase-js exchanges it for a session on its own.
//   If the exchange fails — typically the link was opened in another
//   browser than the one used to sign up, where the PKCE verifier isn't
//   stored — the email is still confirmed (Supabase verified it before
//   redirecting), so the right message is "confirmed, now sign in".
// - `error_code` / `error_description` (query or hash): expired or
//   already-used link.

function readParams() {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#\/?/, "");
  const fromHash = hash.startsWith("error") ? new URLSearchParams(hash) : null;
  const errorCode = query.get("error_code") || fromHash?.get("error_code");
  const errorDescription = query.get("error_description") || fromHash?.get("error_description");
  if (errorCode || errorDescription) return { kind: "error", code: errorCode || "unknown", description: errorDescription || "" };
  if (query.has("code")) return { kind: "code", reset: hash.startsWith("reset-password") };
  return null;
}

export const authReturn = readParams();

// Drop the auth params from the address bar once the session is settled,
// so a reload or a copied link doesn't replay them. Other params (utm_…)
// are kept.
export function clearAuthReturnParams() {
  if (!authReturn) return;
  const url = new URL(window.location.href);
  ["code", "error", "error_code", "error_description"].forEach((k) => url.searchParams.delete(k));
  if (url.hash.replace(/^#\/?/, "").startsWith("error")) url.hash = "";
  window.history.replaceState(window.history.state, "", url.toString());
}

// The message is shown once (on the login screen); after that the return is
// handled and the landing page behaves normally again (e.g. after logout).
let consumed = false;

export function hasPendingAuthReturn() {
  return Boolean(authReturn) && !consumed;
}

export function consumeAuthReturnMessage() {
  if (!authReturn || consumed) return null;
  consumed = true;
  return authReturnMessage();
}

function authReturnMessage() {
  if (authReturn.kind === "code" && authReturn.reset) {
    return {
      type: "error",
      text: "Ce lien de réinitialisation doit être ouvert dans le navigateur où vous l'avez demandé. Redemandez-en un depuis cet appareil avec « Mot de passe oublié ».",
    };
  }
  if (authReturn.kind === "code") {
    return { type: "info", text: "Votre adresse e-mail est confirmée. Connectez-vous pour continuer." };
  }
  if (authReturn.code === "otp_expired") {
    return {
      type: "error",
      text: "Ce lien a expiré ou a déjà été utilisé. Si votre compte est déjà confirmé, connectez-vous ; sinon, réinscrivez-vous pour recevoir un nouveau lien.",
    };
  }
  return { type: "error", text: "Ce lien n'est pas valide. Connectez-vous, ou demandez un nouveau lien." };
}
