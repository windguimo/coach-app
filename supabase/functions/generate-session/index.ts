// Supabase Edge Function — generates (and caches) a course module + 2 quiz
// questions for a subject, using Claude. The Anthropic API key never reaches
// the client: it only exists in this function's environment (set via
// Supabase → Edge Functions → Secrets).
//
// Content is cached in a *shared* library (`content_library` /
// `content_library_questions`), keyed by a normalized topic slug + module
// index — not per user. So the first user anywhere to reach "module 3 of
// Négociation commerciale" pays for the Claude call; every other user on
// that same topic (however they spelled or capitalized it) gets the cached
// content for free. Only lightweight per-user pointer rows (`course_modules`:
// which module a user is on, their notion link) and mastery/attempt data
// stay per user — see supabase/migrations/0002_shared_content_library.sql
// for the normalization/staleness rationale.
//
// POST body: { subject_id: string }
// Auth: forwards the caller's JWT so RLS scopes per-user reads/writes to
// that user; a separate service-role client writes to the shared library
// (RLS only grants authenticated users SELECT on it, by design).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LESSON_TOOL = {
  name: "emit_lesson",
  description: "Emit one structured coaching lesson (a short course + a 2-question quiz) in French.",
  input_schema: {
    type: "object",
    properties: {
      notion_label: { type: "string", description: "Short name (2-5 words) of the specific notion this module teaches." },
      eyebrow: { type: "string", description: "Small label above the title, e.g. 'Cours · lu en 6 min'." },
      title: { type: "string", description: "Lesson title, punchy, 3-6 words." },
      paragraphs: {
        type: "array",
        items: { type: "string" },
        description: "Exactly two paragraphs (array length must be 2) of lesson content, 60-100 words each, encouraging and concrete tone.",
      },
      takeaway: { type: "string", description: "One memorable sentence summarizing the key idea." },
      quiz: {
        type: "array",
        description: "Exactly two quiz questions (array length must be 2).",
        items: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            options: {
              type: "array",
              items: { type: "string" },
              description: "Exactly four answer options (array length must be 4).",
            },
            correct_index: { type: "integer", description: "Index of the correct option in `options`, between 0 and 3 inclusive." },
            explanation: { type: "string", description: "1-2 sentences explaining why the correct option is right." },
          },
          required: ["prompt", "options", "correct_index", "explanation"],
          additionalProperties: false,
        },
      },
    },
    required: ["notion_label", "eyebrow", "title", "paragraphs", "takeaway", "quiz"],
    additionalProperties: false,
  },
  strict: true,
};

async function generateLesson(subjectLabel: string, moduleIndex: number) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      tools: [LESSON_TOOL],
      tool_choice: { type: "tool", name: "emit_lesson" },
      system:
        "Tu es le moteur de contenu d'une app de coaching pour professionnels en montée de compétence. " +
        "Rythme quotidien de 15 minutes, ton encourageant mais exigeant, jamais condescendant. " +
        "Le contenu doit être concret, actionnable, avec des exemples professionnels réalistes. Toujours en français.",
      messages: [
        {
          role: "user",
          content:
            `Génère le module ${moduleIndex} d'un parcours sur le sujet « ${subjectLabel} ». ` +
            `Choisis une notion précise et progressive pour ce module (pas trop large), un cours court dessus, et un quiz de 2 questions qui testent cette notion.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const toolUse = data.content?.find((b: any) => b.type === "tool_use" && b.name === "emit_lesson");
  if (!toolUse) throw new Error("Claude did not return the expected tool call");
  return toolUse.input;
}

const LIBRARY_CONTENT_FIELDS = "id, eyebrow, title, paragraphs, takeaway, read_minutes, notion_label";
const LIBRARY_QUESTION_FIELDS = "id, prompt, options, correct_index, explanation";

// The response only exposes what the client renders — internal fields like
// notion_label (used server-side to link the per-user notion) and
// reuse_count (cache bookkeeping) stay out of it.
function displayContentFields(content: any) {
  const { eyebrow, title, paragraphs, takeaway, read_minutes } = content;
  return { eyebrow, title, paragraphs, takeaway, read_minutes };
}

// Shared-cache lookup: any authenticated client can SELECT content_library
// (RLS grants that), so the user-scoped client is enough here — no need for
// the service-role client on the read path.
async function findLibraryContent(client: any, topicSlug: string, moduleIndex: number) {
  const { data, error } = await client
    .from("content_library")
    .select(`${LIBRARY_CONTENT_FIELDS}, reuse_count, content_library_questions(${LIBRARY_QUESTION_FIELDS})`)
    .eq("topic_slug", topicSlug)
    .eq("module_index", moduleIndex)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Shared-cache write: content_library has no insert policy for regular
// users, so this must go through the service-role client, which bypasses RLS.
async function writeLibraryContent(admin: any, topicSlug: string, topicLabel: string, moduleIndex: number, lesson: any) {
  const { data: created, error } = await admin
    .from("content_library")
    .insert({
      topic_slug: topicSlug,
      topic_label: topicLabel,
      module_index: moduleIndex,
      notion_label: lesson.notion_label,
      eyebrow: lesson.eyebrow,
      title: lesson.title,
      paragraphs: lesson.paragraphs,
      takeaway: lesson.takeaway,
    })
    .select(LIBRARY_CONTENT_FIELDS)
    .single();

  if (error) {
    // Unique violation on (topic_slug, module_index): another request
    // generated this exact module concurrently — reuse it instead of
    // erroring or paying for a second, wasted Claude call.
    if (error.code === "23505") {
      const existing = await findLibraryContent(admin, topicSlug, moduleIndex);
      if (existing) return existing;
    }
    throw error;
  }

  const quizRows = lesson.quiz.map((q: any, i: number) => ({
    content_id: created.id,
    question_index: i + 1,
    prompt: q.prompt,
    options: q.options,
    correct_index: Math.min(Math.max(0, q.correct_index), q.options.length - 1),
    explanation: q.explanation,
  }));
  const { data: questions, error: quizErr } = await admin
    .from("content_library_questions")
    .insert(quizRows)
    .select(LIBRARY_QUESTION_FIELDS);
  if (quizErr) throw quizErr;

  return { ...created, content_library_questions: questions };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY secret is not set on this project");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("missing Authorization header");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("not authenticated");

    const { subject_id } = await req.json();
    if (!subject_id) throw new Error("subject_id is required");

    const { data: subject, error: subjectErr } = await supabase
      .from("subjects")
      .select("id, label")
      .eq("id", subject_id)
      .single();
    if (subjectErr || !subject) throw new Error("subject not found (or not yours)");

    // Each user still progresses through modules 1, 2, 3... independently
    // for their own subject — this stays a per-user count.
    const { count } = await supabase
      .from("course_modules")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", subject_id);
    const moduleIndex = (count ?? 0) + 1;

    // Per-user cache hit: this user already has this module (e.g. duplicate
    // click) — return it as-is, no writes.
    const { data: existing } = await supabase
      .from("course_modules")
      .select(
        `id, module_index, notion_id, content_library (${LIBRARY_CONTENT_FIELDS}, content_library_questions(${LIBRARY_QUESTION_FIELDS}))`,
      )
      .eq("subject_id", subject_id)
      .eq("module_index", moduleIndex)
      .maybeSingle();
    if (existing) {
      const { content_library: content, ...moduleFields } = existing as any;
      return new Response(
        JSON.stringify({
          course_module: { ...moduleFields, ...displayContentFields(content) },
          quiz_questions: content.content_library_questions,
        }),
        { headers: { ...CORS_HEADERS, "content-type": "application/json" } },
      );
    }

    const { data: topicSlug, error: slugErr } = await supabase.rpc("slugify_topic", { p_label: subject.label });
    if (slugErr) throw slugErr;

    let content = await findLibraryContent(supabase, topicSlug, moduleIndex);
    if (content) {
      // Shared cache hit — reuse existing content, no Claude call.
      await admin.from("content_library").update({ reuse_count: content.reuse_count + 1 }).eq("id", content.id);
    } else {
      const lesson = await generateLesson(subject.label, moduleIndex);
      content = await writeLibraryContent(admin, topicSlug, subject.label, moduleIndex, lesson);
    }

    let { data: notion } = await supabase
      .from("notions")
      .select("id")
      .eq("subject_id", subject_id)
      .eq("label", content.notion_label)
      .maybeSingle();
    if (!notion) {
      const { data: created, error: notionErr } = await supabase
        .from("notions")
        .insert({ user_id: user.id, subject_id, label: content.notion_label })
        .select("id")
        .single();
      if (notionErr) throw notionErr;
      notion = created;
    }

    const { data: courseModule, error: moduleErr } = await supabase
      .from("course_modules")
      .insert({
        user_id: user.id,
        subject_id,
        notion_id: notion.id,
        module_index: moduleIndex,
        content_id: content.id,
      })
      .select("id, module_index, notion_id")
      .single();
    if (moduleErr) throw moduleErr;

    return new Response(
      JSON.stringify({
        course_module: { ...courseModule, ...displayContentFields(content) },
        quiz_questions: content.content_library_questions,
      }),
      { headers: { ...CORS_HEADERS, "content-type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
});
