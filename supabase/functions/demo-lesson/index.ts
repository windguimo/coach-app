// Supabase Edge Function — public landing-page demo. A logged-out visitor
// types a subject; this streams back a mini-lesson + one quiz question as
// Claude writes it, so the landing page can render it live.
//
// Deployed with verify_jwt = false (visitors have no account). Because the
// endpoint is open, cost is bounded three ways (see migration 0012):
//   1. cache: generated text is stored per normalized topic in
//      `demo_lessons`; a cache hit replays it for free, unlimited;
//   2. per visitor: at most PER_IP_DAILY generations per salted IP hash/day;
//   3. global: at most GLOBAL_DAILY generations/day across all visitors.
// Only cache misses count toward 2 and 3.
//
// Response: text/plain, streamed. Line-based format the client parses
// incrementally (src/lib/demoLesson.js):
//   TITRE: …
//   § paragraph (×3)
//   RETENIR: …
//   QUESTION: …
//   A) … / B) … / C) … / D) …
//   REPONSE: B
//   EXPLICATION: …
// or a single line `REFUS: …` for a topic that isn't a legitimate learning
// subject (never cached). Errors before streaming starts come back as JSON
// { error, code } with a non-200 status.
//
// POST body: { topic: string }

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Salt for IP hashing; falls back to a slice of the service key (secret,
// stable) so no extra secret is required to deploy.
const IP_SALT = Deno.env.get("DEMO_IP_SALT") ?? SUPABASE_SERVICE_ROLE_KEY.slice(-24);

const MODEL = "claude-sonnet-5";
const PER_IP_DAILY = 3;
const GLOBAL_DAILY = 200;

const SYSTEM_PROMPT =
  "Tu es le moteur de contenu d'une app de coaching quotidien (15 minutes par jour). " +
  "Tu écris une démonstration courte, concrète et accrocheuse pour un visiteur qui découvre l'app. " +
  "Ton encourageant mais exigeant, jamais condescendant, exemples réalistes. Toujours en français. " +
  "Tu respectes EXACTEMENT le format demandé, sans markdown (pas de **, pas de #), sans texte avant ni après.";

function userPrompt(topic: string) {
  return (
    `Sujet choisi par le visiteur : « ${topic} ».\n\n` +
    "Si ce sujet n'est pas un sujet d'apprentissage légitime (contenu haineux, sexuel, dangereux, ou du charabia), " +
    "réponds uniquement par une ligne `REFUS: ` suivie d'une phrase courte et aimable invitant à essayer un autre sujet.\n\n" +
    "Sinon, choisis UNE notion précise et utile de ce sujet (pas une introduction générale) et réponds exactement dans ce format, une info par ligne :\n" +
    "TITRE: <titre percutant, 3 à 6 mots>\n" +
    "§ <paragraphe 1, 35 à 55 mots>\n" +
    "§ <paragraphe 2, 35 à 55 mots, avec un exemple concret>\n" +
    "§ <paragraphe 3, 35 à 55 mots>\n" +
    "RETENIR: <une phrase mémorable>\n" +
    "QUESTION: <une question de mise en situation qui teste la notion>\n" +
    "A) <option>\nB) <option>\nC) <option>\nD) <option>\n" +
    "REPONSE: <lettre de la bonne option>\n" +
    "EXPLICATION: <une ou deux phrases expliquant la bonne réponse>"
  );
}

// Minimal well-formedness check before caching — a truncated or off-format
// generation is served to the visitor who triggered it but never cached.
function isWellFormed(text: string) {
  const lines = text.split("\n").map((l) => l.trim());
  const has = (p: string) => lines.some((l) => l.startsWith(p));
  const paragraphs = lines.filter((l) => l.startsWith("§")).length;
  const options = lines.filter((l) => /^[A-D]\)/.test(l)).length;
  return (
    has("TITRE:") && paragraphs >= 2 && has("RETENIR:") && has("QUESTION:") &&
    options === 4 && lines.some((l) => /^REPONSE:\s*[A-D]/.test(l)) && has("EXPLICATION:")
  );
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function textStream(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return (
    req.headers.get("cf-connecting-ip") ??
    (fwd ? fwd.split(",")[0].trim() : null) ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée", code: "method" }, 405);

  let topic = "";
  try {
    const body = await req.json();
    topic = String(body?.topic ?? "").replace(/\s+/g, " ").trim();
  } catch {
    // fall through to validation
  }
  if (topic.length < 2 || topic.length > 80) {
    return json({ error: "Écrivez un sujet de 2 à 80 caractères.", code: "invalid_topic" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: slug, error: slugErr } = await admin.rpc("slugify_topic", { p_label: topic });
  if (slugErr || !slug) {
    return json({ error: "Écrivez un sujet avec des lettres ou des chiffres.", code: "invalid_topic" }, 400);
  }

  // 1. Cache hit → free replay.
  const { data: cached } = await admin
    .from("demo_lessons")
    .select("content, hit_count")
    .eq("topic_slug", slug)
    .maybeSingle();
  if (cached) {
    admin.from("demo_lessons").update({ hit_count: cached.hit_count + 1 }).eq("topic_slug", slug).then(() => {});
    return textStream(new Blob([cached.content]).stream());
  }

  if (!ANTHROPIC_API_KEY) return json({ error: "Démo indisponible.", code: "unavailable" }, 503);

  // 2-3. Rate limits (generations only).
  const ipHash = await sha256(`${IP_SALT}:${clientIp(req)}`);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ count: ipCount }, { count: globalCount }] = await Promise.all([
    admin.from("demo_requests").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since),
    admin.from("demo_requests").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  if ((ipCount ?? 0) >= PER_IP_DAILY) {
    return json({ error: "Vous avez essayé 3 sujets aujourd'hui — créez un compte pour continuer.", code: "rate_limited" }, 429);
  }
  if ((globalCount ?? 0) >= GLOBAL_DAILY) {
    return json({ error: "La démo a beaucoup servi aujourd'hui — choisissez un sujet suggéré ou créez un compte.", code: "busy" }, 429);
  }
  await admin.from("demo_requests").insert({ ip_hash: ipHash, topic_slug: slug });

  const startedAt = Date.now();
  // One row per Anthropic call in llm_usage (migration 0014); cost_usd is
  // computed by a trigger from llm_prices.
  const logUsage = async (row: Record<string, unknown>) => {
    const { error } = await admin.from("llm_usage").insert({
      function_name: "demo-lesson",
      model: MODEL,
      topic_slug: slug,
      duration_ms: Date.now() - startedAt,
      ...row,
    });
    if (error) console.error("llm_usage insert failed:", error.message);
  };

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      stream: true,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt(topic) }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    console.error("Anthropic error", upstream.status, await upstream.text().catch(() => ""));
    await logUsage({ ok: false, error: `HTTP ${upstream.status}` });
    return json({ error: "La génération a échoué, réessayez dans un instant.", code: "upstream" }, 502);
  }

  // Anthropic SSE → plain text: forward each text_delta as it arrives,
  // accumulate the full text, cache it at the end if well-formed.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let full = "";
  let sseBuffer = "";
  const usage = { input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0 };
  let streamError: string | null = null;

  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = sseBuffer.indexOf("\n")) !== -1) {
            const line = sseBuffer.slice(0, nl).trim();
            sseBuffer = sseBuffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            let evt;
            try {
              evt = JSON.parse(line.slice(5));
            } catch {
              continue;
            }
            if (evt.type === "message_start") {
              const u = evt.message?.usage ?? {};
              usage.input_tokens = u.input_tokens ?? 0;
              usage.cache_creation_tokens = u.cache_creation_input_tokens ?? 0;
              usage.cache_read_tokens = u.cache_read_input_tokens ?? 0;
              usage.output_tokens = u.output_tokens ?? 0;
            } else if (evt.type === "message_delta" && evt.usage?.output_tokens != null) {
              usage.output_tokens = evt.usage.output_tokens; // cumulative
            } else if (evt.type === "error") {
              streamError = evt.error?.type ?? "stream error";
            } else if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              full += evt.delta.text;
              controller.enqueue(encoder.encode(evt.delta.text));
            }
          }
        }
      } catch (err) {
        console.error("stream error", err);
        streamError = String(err).slice(0, 200);
      } finally {
        controller.close();
      }

      await logUsage({ ...usage, ok: !streamError, error: streamError });

      const text = full.trim();
      if (isWellFormed(text)) {
        await admin.from("demo_lessons").upsert({ topic_slug: slug, topic_label: topic, content: text }, { onConflict: "topic_slug", ignoreDuplicates: true });
      }
    },
  });

  return textStream(out);
});
