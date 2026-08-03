/**
 * Markdown <-> missions converter.
 *
 * Format (one mission per `##` heading):
 *
 * # Pack: Space Explorers
 * Description: A journey through the solar system
 * Language: en
 *
 * ## Mission: The Red Planet
 * Type: multiple_choice
 * Category: Geography
 * Points: 10
 * Question: Which planet is called the red planet?
 * Choices:
 * - Venus
 * - *Mars
 * - Jupiter
 * Answer: Mars
 * Password: MARS2024
 * Hints:
 * - It is the 4th planet
 * Image: https://...
 * Validation: teacher
 * Skip: yes
 * TimeBonus: 30
 * Explanation: Mars looks red because of iron oxide.
 */

import type { MissionType } from "./missions";
import { MISSION_TYPES } from "./missions";

export type ParsedMission = {
  title: string;
  type: MissionType;
  category: string;
  question: string;
  media_url: string | null;
  media_type: string | null;
  choices: string[];
  answer: string[] | string | null;
  password: string | null;
  hints: string[];
  points: number;
  time_bonus: number;
  allow_skip: boolean;
  requires_validation: boolean;
  explanation: string;
};

export type ParsedPack = {
  title: string;
  description: string;
  language: string;
  missions: ParsedMission[];
};

export const MARKDOWN_TEMPLATE = `# Pack: Space Explorers
Description: A journey through the solar system
Language: en

## Mission: The Red Planet
Type: multiple_choice
Category: Geography
Points: 10
Question: Which planet is called the red planet?
Choices:
- Venus
- *Mars
- Jupiter
Answer: Mars
Hints:
- It is the fourth planet from the Sun
Explanation: Mars looks red because of iron oxide dust.

## Mission: Secret Code
Type: password
Points: 15
Question: Find the code hidden in the classroom.
Password: NEBULA
Skip: yes

## Mission: Build a rocket
Type: teacher_validation
Points: 20
Question: Build a paper rocket and show it to your teacher.
Validation: teacher
`;

const TYPE_ALIASES: Record<string, MissionType> = {
  mcq: "multiple_choice",
  multiple: "multiple_choice",
  multiple_choice: "multiple_choice",
  choice: "multiple_choice",
  text: "text",
  open: "text",
  number: "number",
  numeric: "number",
  password: "password",
  code: "password",
  boolean: "true_false",
  true_false: "true_false",
  truefalse: "true_false",
  ordering: "ordering",
  order: "ordering",
  matching: "matching",
  match: "matching",
  image: "image_question",
  image_question: "image_question",
  image_upload: "image_upload",
  photo: "image_upload",
  qr: "qr_code",
  qr_code: "qr_code",
  google_earth: "google_earth",
  earth: "google_earth",
  external: "external",
  link: "external",
  video: "video",
  youtube: "video",
  human_benchmark: "human_benchmark",
  benchmark: "human_benchmark",
  teacher: "teacher_validation",
  teacher_validation: "teacher_validation",
  custom: "custom",
};

function normType(raw: string): MissionType {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (TYPE_ALIASES[key]) return TYPE_ALIASES[key];
  const direct = MISSION_TYPES.find((t) => t.value === key);
  return direct ? direct.value : "custom";
}

const truthy = (v: string) => /^(yes|true|oui|1|teacher|manual|نعم)$/i.test(v.trim());

function emptyMission(title: string): ParsedMission {
  return {
    title,
    type: "text",
    category: "",
    question: "",
    media_url: null,
    media_type: null,
    choices: [],
    answer: null,
    password: null,
    hints: [],
    points: 10,
    time_bonus: 0,
    allow_skip: false,
    requires_validation: false,
    explanation: "",
  };
}

export function parseMarkdown(input: string): ParsedPack {
  const pack: ParsedPack = { title: "Imported pack", description: "", language: "en", missions: [] };
  const lines = input.replace(/\r/g, "").split("\n");

  let current: ParsedMission | null = null;
  let listTarget: "choices" | "hints" | null = null;
  let freeTarget: "question" | "explanation" | null = null;

  const commit = () => {
    if (current) {
      if (current.choices.length && !current.answer) {
        const starred = current.choices.filter((c) => c.startsWith("*"));
        if (starred.length) current.answer = starred.map((c) => c.replace(/^\*/, "").trim());
      }
      current.choices = current.choices.map((c) => c.replace(/^\*/, "").trim());
      pack.missions.push(current);
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    const packHeading = trimmed.match(/^#\s+(?:pack\s*:\s*)?(.+)$/i);
    const missionHeading = trimmed.match(/^#{2,3}\s+(?:mission\s*\d*\s*:\s*|mission\s*:\s*)?(.+)$/i);

    if (missionHeading) {
      commit();
      listTarget = null;
      freeTarget = null;
      current = emptyMission(missionHeading[1].trim());
      continue;
    }
    if (packHeading && !current) {
      pack.title = packHeading[1].trim();
      continue;
    }

    const listItem = trimmed.match(/^[-*+]\s+(.*)$/) || trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (listItem && listTarget && current) {
      const value = listItem[1].trim();
      if (listTarget === "choices") current.choices.push(value);
      else current.hints.push(value.replace(/^\*/, "").trim());
      continue;
    }

    const field = trimmed.match(/^([A-Za-z_ ]{2,20})\s*:\s*(.*)$/);
    if (field) {
      const key = field[1].trim().toLowerCase().replace(/\s+/g, "");
      const value = field[2].trim();
      listTarget = null;
      freeTarget = null;

      if (!current) {
        if (key === "description") pack.description = value;
        else if (key === "language" || key === "lang") pack.language = value.toLowerCase().slice(0, 2);
        else if (key === "pack" || key === "title") pack.title = value;
        continue;
      }

      switch (key) {
        case "type":
          current.type = normType(value);
          break;
        case "category":
          current.category = value;
          break;
        case "points":
          current.points = Number(value) || 10;
          break;
        case "timebonus":
        case "bonus":
          current.time_bonus = Number(value) || 0;
          break;
        case "question":
        case "instructions":
        case "task":
          current.question = value;
          freeTarget = "question";
          break;
        case "choices":
        case "options":
          current.choices = value ? value.split("|").map((c) => c.trim()) : [];
          listTarget = "choices";
          break;
        case "answer":
        case "correct":
          current.answer = value.includes("|") ? value.split("|").map((v) => v.trim()) : value;
          break;
        case "password":
        case "code":
          current.password = value;
          break;
        case "hints":
        case "hint":
          if (value) current.hints.push(value);
          listTarget = "hints";
          break;
        case "image":
        case "media":
        case "gif":
          current.media_url = value;
          current.media_type = "image";
          break;
        case "video":
          current.media_url = value;
          current.media_type = "video";
          break;
        case "audio":
          current.media_url = value;
          current.media_type = "audio";
          break;
        case "url":
        case "link":
          current.media_url = value;
          current.media_type = "link";
          break;
        case "validation":
          current.requires_validation = truthy(value);
          break;
        case "skip":
          current.allow_skip = truthy(value);
          break;
        case "explanation":
          current.explanation = value;
          freeTarget = "explanation";
          break;
        default:
          break;
      }
      continue;
    }

    if (current && trimmed && freeTarget) {
      current[freeTarget] = `${current[freeTarget]}\n${trimmed}`.trim();
    } else if (current && trimmed && !current.question) {
      current.question = trimmed;
      freeTarget = "question";
    }
  }
  commit();

  return pack;
}

export function toMarkdown(pack: { title: string; description?: string | null; language?: string }, missions: ParsedMission[]) {
  const out: string[] = [`# Pack: ${pack.title}`];
  if (pack.description) out.push(`Description: ${pack.description}`);
  out.push(`Language: ${pack.language ?? "en"}`, "");

  for (const m of missions) {
    out.push(`## Mission: ${m.title}`);
    out.push(`Type: ${m.type}`);
    if (m.category) out.push(`Category: ${m.category}`);
    out.push(`Points: ${m.points}`);
    if (m.time_bonus) out.push(`TimeBonus: ${m.time_bonus}`);
    if (m.question) out.push(`Question: ${m.question}`);
    if (m.choices?.length) {
      out.push("Choices:");
      const answers = Array.isArray(m.answer) ? m.answer.map(String) : m.answer ? [String(m.answer)] : [];
      for (const c of m.choices) out.push(`- ${answers.includes(c) ? "*" : ""}${c}`);
    }
    if (m.answer && !Array.isArray(m.answer)) out.push(`Answer: ${m.answer}`);
    else if (Array.isArray(m.answer) && m.answer.length) out.push(`Answer: ${m.answer.join(" | ")}`);
    if (m.password) out.push(`Password: ${m.password}`);
    if (m.media_url) out.push(`${m.media_type === "video" ? "Video" : m.media_type === "audio" ? "Audio" : m.media_type === "link" ? "Link" : "Image"}: ${m.media_url}`);
    if (m.hints?.length) {
      out.push("Hints:");
      for (const h of m.hints) out.push(`- ${h}`);
    }
    if (m.requires_validation) out.push("Validation: teacher");
    if (m.allow_skip) out.push("Skip: yes");
    if (m.explanation) out.push(`Explanation: ${m.explanation}`);
    out.push("");
  }
  return out.join("\n");
}

export function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
