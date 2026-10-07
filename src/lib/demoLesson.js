import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabaseClient";

// Client for the public `demo-lesson` Edge Function (landing page). The
// function streams a line-based plain-text format (see the header comment
// of supabase/functions/demo-lesson/index.ts); parseDemoLesson turns any
// prefix of that text into a partial lesson, so the landing can re-parse
// the visible text on every frame and render it as it "types".

export async function fetchDemoLesson(topic, { signal, onText }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/demo-lesson`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ topic }),
  });

  if (!res.ok) {
    let message = "La démo est indisponible pour le moment.";
    let code = "error";
    try {
      const body = await res.json();
      message = body.error || message;
      code = body.code || code;
    } catch {
      // keep defaults
    }
    const err = new Error(message);
    err.code = code;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  text += decoder.decode();
  onText(text);
  return text;
}

const OPTION_RE = /^([A-D])\)\s*(.*)$/;

// Lines are only trusted once complete, except the last one, which is
// rendered as in-progress text for the field it belongs to.
export function parseDemoLesson(text) {
  const lesson = {
    refusal: null,
    title: "",
    paragraphs: [],
    takeaway: "",
    question: "",
    options: [],
    answerIndex: null,
    explanation: "",
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if (line.startsWith("REFUS:")) lesson.refusal = line.slice(6).trim();
    else if (line.startsWith("TITRE:")) lesson.title = line.slice(6).trim();
    else if (line.startsWith("§")) lesson.paragraphs.push(line.slice(1).trim());
    else if (line.startsWith("RETENIR:")) lesson.takeaway = line.slice(8).trim();
    else if (line.startsWith("QUESTION:")) lesson.question = line.slice(9).trim();
    else if ((m = line.match(OPTION_RE))) lesson.options.push(m[2]);
    else if (line.startsWith("REPONSE:")) {
      const letter = line.slice(8).trim().charAt(0).toUpperCase();
      const idx = "ABCD".indexOf(letter);
      lesson.answerIndex = idx >= 0 ? idx : null;
    } else if (line.startsWith("EXPLICATION:")) lesson.explanation = line.slice(12).trim();
    else if (lesson.explanation) lesson.explanation += ` ${line}`;
    else if (lesson.paragraphs.length && !lesson.takeaway) lesson.paragraphs[lesson.paragraphs.length - 1] += ` ${line}`;
  }

  return lesson;
}

// The quiz is only playable once the whole question block has arrived.
export function isQuizReady(lesson) {
  return Boolean(lesson.question && lesson.options.length === 4 && lesson.answerIndex !== null && lesson.explanation);
}
