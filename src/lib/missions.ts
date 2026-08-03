/**
 * Mission engine.
 *
 * Adding a new mission type = add an entry to MISSION_TYPES and, if it needs a
 * custom check, a case in `checkAnswer`. Nothing else in the app is hardcoded
 * to a specific type.
 */

export type MissionType =
  | "multiple_choice"
  | "text"
  | "number"
  | "password"
  | "true_false"
  | "ordering"
  | "matching"
  | "image_question"
  | "image_upload"
  | "qr_code"
  | "google_earth"
  | "external"
  | "video"
  | "human_benchmark"
  | "teacher_validation"
  | "custom";

export type Mission = {
  id: string;
  pack_id: string;
  order_index: number;
  title: string;
  type: MissionType;
  category: string | null;
  question: string | null;
  media_url: string | null;
  media_type: string | null;
  choices: string[];
  answer: unknown;
  password: string | null;
  hints: string[];
  points: number;
  time_bonus: number;
  allow_skip: boolean;
  requires_validation: boolean;
  explanation: string | null;
};

export const MISSION_TYPES: { value: MissionType; label: string; icon: string; alwaysManual?: boolean }[] = [
  { value: "multiple_choice", label: "Multiple choice", icon: "🔘" },
  { value: "text", label: "Text answer", icon: "✏️" },
  { value: "number", label: "Numeric answer", icon: "🔢" },
  { value: "password", label: "Password", icon: "🔑" },
  { value: "true_false", label: "True / False", icon: "⚖️" },
  { value: "ordering", label: "Ordering", icon: "🔀" },
  { value: "matching", label: "Matching", icon: "🧩" },
  { value: "image_question", label: "Image question", icon: "🖼️" },
  { value: "image_upload", label: "Image upload", icon: "📸", alwaysManual: true },
  { value: "qr_code", label: "QR code challenge", icon: "🔳" },
  { value: "google_earth", label: "Google Earth task", icon: "🌍" },
  { value: "external", label: "External activity", icon: "🔗" },
  { value: "video", label: "Video / YouTube", icon: "🎬" },
  { value: "human_benchmark", label: "Human Benchmark", icon: "🧠" },
  { value: "teacher_validation", label: "Teacher validation", icon: "🙋", alwaysManual: true },
  { value: "custom", label: "Custom instructions", icon: "⭐" },
];

export function typeMeta(type: string) {
  return MISSION_TYPES.find((m) => m.value === type) ?? MISSION_TYPES[MISSION_TYPES.length - 1];
}

export function needsTeacher(mission: Pick<Mission, "type" | "requires_validation">) {
  return mission.requires_validation || Boolean(typeMeta(mission.type).alwaysManual);
}

const normalize = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?؟]$/u, "");

function answerList(mission: Mission): string[] {
  const a = mission.answer;
  if (Array.isArray(a)) return a.map((x) => normalize(x));
  if (a === null || a === undefined || a === "") return [];
  return [normalize(a)];
}

/** Returns true when the submitted answer can be auto-validated as correct. */
export function checkAnswer(mission: Mission, submitted: string): boolean {
  const given = normalize(submitted);
  if (!given) return false;

  switch (mission.type) {
    case "password":
    case "qr_code":
      return normalize(mission.password) === given || answerList(mission).includes(given);
    case "number": {
      const expected = answerList(mission)[0];
      const a = Number(given.replace(",", "."));
      const b = Number(String(expected).replace(",", "."));
      if (Number.isNaN(a) || Number.isNaN(b)) return given === expected;
      return Math.abs(a - b) < 1e-6;
    }
    case "true_false": {
      const expected = answerList(mission)[0];
      const truthy = ["true", "vrai", "صحيح", "yes", "1"];
      return truthy.includes(given) === truthy.includes(expected);
    }
    case "ordering":
    case "matching": {
      const expected = Array.isArray(mission.answer) ? mission.answer.map(normalize) : [];
      const got = submitted
        .split(/\n|,|>/)
        .map(normalize)
        .filter(Boolean);
      return expected.length > 0 && expected.length === got.length && expected.every((v, i) => v === got[i]);
    }
    default: {
      const list = answerList(mission);
      if (mission.password) return normalize(mission.password) === given || list.includes(given);
      return list.includes(given);
    }
  }
}

/** Mission is playable without any answer (informational / external activity). */
export function isOpenEnded(mission: Mission) {
  return needsTeacher(mission) && !mission.password && answerList(mission).length === 0;
}

export function orderMissions(missions: Mission[], mode: string, randomize: boolean, seed: string): Mission[] {
  const list = [...missions].sort((a, b) => a.order_index - b.order_index);
  if (mode === "categories") {
    return [...list].sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.order_index - b.order_index);
  }
  if (mode === "random" || randomize) {
    // Deterministic shuffle per team so refreshes keep the same order.
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const rand = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  return list;
}
