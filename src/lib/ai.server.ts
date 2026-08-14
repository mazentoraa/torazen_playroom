/**
 * Server-only module: quiz-pack generation through an LLM.
 *
 * This file must only ever be imported dynamically from inside a server
 * function handler — it ships provider SDK code that must never reach the
 * client bundle.
 */
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { parseMarkdown, type ParsedPack } from "./markdown";
import { generationSchema, type GenerationPreferences } from "./ai-types";

const AUTOCHECKABLE_TYPES = [
  "multiple_choice",
  "true_false",
  "text",
  "number",
  "password",
  "ordering",
  "matching",
] as const;

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GOOGLE_MODEL = "gemini-3.6-flash";

const DIFFICULTY_GUIDANCE: Record<GenerationPreferences["difficulty"], string> = {
  easy: "Difficulty level: easy — below-grade, simple vocabulary, short questions, 5–10 points.",
  medium: "Difficulty level: medium — on-grade, requires a bit of thought, 10–15 points.",
  hard: "Difficulty level: hard — above-grade, requires research or problem solving, 15–25 points.",
};

const ALLOWED_TYPES_GUIDANCE = (allowManual: boolean) =>
  allowManual
    ? [
        "multiple_choice",
        "true_false",
        "text",
        "number",
        "password",
        "ordering",
        "matching",
        "teacher_validation",
        "image_question",
      ].join(", ")
    : AUTOCHECKABLE_TYPES.join(", ");

function buildSystemPrompt(prefs: GenerationPreferences): string {
  return `You generate quiz packs for a live classroom challenge game. The app imports packs written in a strict plain-text "mission markdown" format. Output ONLY that markdown — no preface, no code fences, no trailing commentary.

## Pack header (first lines)

# Pack: <Pack title>
Description: <one-line description>
Language: ${prefs.language}

## Mission format

Every mission starts with its own heading:

## Mission: <Mission title>
Type: <type>
Category: <category>
Points: <points>
Question: <question text>
Choices:
- <option A>
- *<correct option, prefixed with *>
- <option C>
Answer: <correct answer, exactly matching the starred choice>
Hints:
- <hint 1>
- <hint 2>
Explanation: <one-line explanation>

## Mission types you may use

- multiple_choice — 3 or 4 choices; write them under "Choices:" (one per line), prefix the single correct one with "*", and repeat that exact text in "Answer:"
- true_false — a true/false statement; "Choices:" with one "true" line and one "false" line, star the correct one, repeat it in "Answer:"
- text — a short free-text answer; put the answer in "Answer:"
- number — a numeric answer; put the number in "Answer:"
- password — a secret code/word players must find; put it in "Password: <code>"
- ordering — a sequence; put the ordered items in "Answer:", separated by " | "
- matching — pairs; put one "left = right" pair per line under "Answer:"
${prefs.allowManual ? '- teacher_validation — build a hands-on task teams must show the teacher; set "Validation: teacher" and leave "Answer:" out\n- image_question — a question illustrated by a real, working public image URL under "Image: <url>"' : ""}

Use ONLY these types: ${ALLOWED_TYPES_GUIDANCE(prefs.allowManual)}. Never use a type outside this list.

## Rules
- Every word of content (title, questions, choices, answers, hints, explanations) MUST be written in ${prefs.language === "en" ? "English" : prefs.language === "fr" ? "French" : "Modern Standard Arabic"}.
- Write exactly ${prefs.count} missions.
- ${DIFFICULTY_GUIDANCE[prefs.difficulty]}
- "Answer:" must exactly match one of the starred "Choices:" entries — never invent answers.
- Never invent image, video or link URLs.
- Give most missions 0–2 "Hints:".
- Every mission must include a "Question:" (or "Instructions:") line.
- Grading is automatic: be unambiguous and factually correct.
- School-appropriate and family-friendly.`;
}

function getModel() {
  const provider = (process.env.AI_PROVIDER ?? "auto").toLowerCase();
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (googleKey && (provider === "auto" || provider === "google")) {
    const google = createGoogle({ apiKey: googleKey, baseURL: process.env.AI_BASE_URL });
    return google(process.env.AI_MODEL ?? DEFAULT_GOOGLE_MODEL);
  }

  if (openaiKey && (provider === "auto" || provider === "openai")) {
    const openai = createOpenAI({ apiKey: openaiKey, baseURL: process.env.AI_BASE_URL });
    return openai(process.env.AI_MODEL ?? DEFAULT_OPENAI_MODEL);
  }

  throw new Error(
    "AI quiz generation is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY in your environment (optionally AI_MODEL / AI_PROVIDER).",
  );
}

const rateBuckets = new Map<string, number[]>();

function checkRateLimit(userId: string, max = 8, windowMs = 10 * 60_000) {
  const now = Date.now();
  const hits = (rateBuckets.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    throw new Error("Too many AI generations. Please wait a few minutes and try again.");
  }
  hits.push(now);
  rateBuckets.set(userId, hits);
}

export async function generatePackMarkdown(input: unknown, userId: string): Promise<ParsedPack> {
  const parsed = generationSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      "Your request is missing required options (topic, language, number of missions).",
    );
  }
  const prefs = parsed.data;
  checkRateLimit(userId);

  const { text } = await generateText({
    model: getModel(),
    system: buildSystemPrompt(prefs),
    prompt: prefs.prompt,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });

  const pack = parseMarkdown(text);
  if (!pack.missions.length) {
    throw new Error("The AI did not return any valid missions. Try rephrasing your prompt.");
  }

  const allowed = new Set<string>(AUTOCHECKABLE_TYPES);
  if (prefs.allowManual) allowed.add("teacher_validation");

  pack.missions = pack.missions.filter((m) => allowed.has(m.type)).slice(0, prefs.count);

  if (!pack.missions.length) {
    throw new Error(
      "The AI only generated missions that need teacher review. Enable that option or rephrase.",
    );
  }

  if (!pack.title || pack.title.toLowerCase() === "imported pack") {
    pack.title = "AI generated pack";
  }
  if (!pack.language) pack.language = prefs.language;
  pack.language = pack.language.slice(0, 2);

  return pack;
}
