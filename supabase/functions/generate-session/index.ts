// Supabase Edge Function — generates (and caches) a course module + 2 quiz
// questions for a subject, using Claude. The Anthropic API key never reaches
// the client: it only exists in this function's environment (set via
// Supabase → Edge Functions → Secrets).
//
// POST body: { subject_id: string }
// Auth: forwards the caller's JWT so RLS scopes everything to that user.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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
        minItems: 2,
        maxItems: 2,
        description: "Exactly two paragraphs of lesson content, 60-100 words each, encouraging and concrete tone.",
      },
      takeaway: { type: "string", description: "One memorable sentence summarizing the key idea." },
      quiz: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            correct_index: { type: "integer", minimum: 0, maximum: 3 },
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
      model: "claude-opus-5",
      max_tokens: 4000,
      output_config: { effort: "medium" },
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY secret is not set on this project");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("missing Authorization header");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

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

    const { count } = await supabase
      .from("course_modules")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", subject_id);
    const moduleIndex = (count ?? 0) + 1;

    // Cache hit: module already generated (e.g. duplicate click) — return it as-is.
    const { data: existing } = await supabase
      .from("course_modules")
      .select("*, quiz_questions(*)")
      .eq("subject_id", subject_id)
      .eq("module_index", moduleIndex)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ course_module: existing, quiz_questions: existing.quiz_questions }), {
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }

    const lesson = await generateLesson(subject.label, moduleIndex);

    let { data: notion } = await supabase
      .from("notions")
      .select("id")
      .eq("subject_id", subject_id)
      .eq("label", lesson.notion_label)
      .maybeSingle();
    if (!notion) {
      const { data: created, error: notionErr } = await supabase
        .from("notions")
        .insert({ user_id: user.id, subject_id, label: lesson.notion_label })
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
        eyebrow: lesson.eyebrow,
        title: lesson.title,
        paragraphs: lesson.paragraphs,
        takeaway: lesson.takeaway,
      })
      .select()
      .single();
    if (moduleErr) throw moduleErr;

    const quizRows = lesson.quiz.map((q: any, i: number) => ({
      user_id: user.id,
      course_module_id: courseModule.id,
      subject_id,
      question_index: i + 1,
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
    }));
    const { data: quizQuestions, error: quizErr } = await supabase.from("quiz_questions").insert(quizRows).select();
    if (quizErr) throw quizErr;

    return new Response(JSON.stringify({ course_module: courseModule, quiz_questions: quizQuestions }), {
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 400,
      headers: { ...CORS_HEADERS, "content-type": "application/json" },
    });
  }
});
