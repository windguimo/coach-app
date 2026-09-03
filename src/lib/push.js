import { supabase } from "./supabaseClient";

// Public VAPID key — safe to ship in client code (it's how the browser
// verifies pushes come from our server, not a secret by itself). The
// matching private key lives only as a Supabase Edge Function secret.
const VAPID_PUBLIC_KEY = "BOm5tIkB88OkvIZdz8yySeWwQk98L5xYDG15-JrHodLiVNBz9B2eRccYgVZTcXVwiNC9NQBXlURlrrKG4KZi1Kk";

// NOTE: iOS Safari only supports Web Push for a site added to the Home
// Screen (PWA install) — plain browser tabs on iOS won't receive pushes,
// even after a successful subscribe() call. Desktop and Android Chrome/
// Firefox work in a regular tab.
export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush() {
  if (!pushSupported()) throw new Error("Les notifications ne sont pas supportées sur ce navigateur.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permission refusée.");

  const registration = await navigator.serviceWorker.register("sw.js");
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const json = subscription.toJSON();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
    },
    { onConflict: "user_id,endpoint" }
  );
  if (error) throw error;
}

export async function isPushSubscribed() {
  if (!pushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  const sub = await registration.pushManager.getSubscription();
  return !!sub;
}
