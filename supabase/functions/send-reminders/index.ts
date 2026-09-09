// Supabase Edge Function — sends a push notification to every user who has
// a session scheduled today and hasn't done it yet. Meant to be triggered
// once a day by pg_cron (see supabase/migrations/0004_cron_reminders.sql),
// not by end users — protected by a shared secret header, not user auth.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const VAPID_PUBLIC_KEY = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:contact@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  const secret = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  const { data: pending, error: pendingErr } = await supabase
    .from("plan_days")
    .select("user_id")
    .eq("day_date", today)
    .in("status", ["today", "upcoming"]);
  if (pendingErr) return new Response(JSON.stringify({ error: pendingErr.message }), { status: 500 });

  const userIds = [...new Set((pending ?? []).map((r) => r.user_id))];
  if (userIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0, candidates: 0 }), { headers: { "content-type": "application/json" } });
  }

  const { data: subs, error: subsErr } = await supabase.from("push_subscriptions").select("*").in("user_id", userIds);
  if (subsErr) return new Response(JSON.stringify({ error: subsErr.message }), { status: 500 });

  let sent = 0;
  let removed = 0;
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify({
          title: "Coach",
          body: "Il vous reste quelques minutes aujourd'hui pour tenir votre série.",
          url: "./",
        })
      );
      sent++;
    } catch (err) {
      // 404/410 = the subscription is dead (user revoked it, browser data cleared, ...) — clean it up.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        removed++;
      }
    }
  }

  return new Response(JSON.stringify({ sent, removed, candidates: userIds.length }), {
    headers: { "content-type": "application/json" },
  });
});
