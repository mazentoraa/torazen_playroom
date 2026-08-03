import type { Mission } from "./missions";

export type QuizPack = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  language: string;
  created_at: string;
};

export type GameSession = {
  id: string;
  owner_id: string;
  pack_id: string;
  title: string;
  code: string;
  mode: "sequential" | "random" | "categories" | "treasure";
  language: string;
  timer_seconds: number;
  randomize: boolean;
  hint_penalty: number;
  status: "lobby" | "running" | "paused" | "finished";
  announcement: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type Team = {
  id: string;
  session_id: string;
  name: string;
  color: string;
  score: number;
  current_index: number;
  completed: string[];
  hints_used: string[];
  finished_at: string | null;
  joined_at: string;
  last_activity: string;
};

export type Submission = {
  id: string;
  session_id: string;
  team_id: string;
  mission_id: string;
  answer: string | null;
  media_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type { Mission };

export const TEAM_COLORS = ["sunny", "coral", "mint", "sky", "grape", "primary"] as const;

export const TEAM_SWATCH: Record<string, string> = {
  sunny: "bg-sunny text-sunny-foreground",
  coral: "bg-coral text-coral-foreground",
  mint: "bg-mint text-mint-foreground",
  sky: "bg-sky text-sky-foreground",
  grape: "bg-grape text-grape-foreground",
  primary: "bg-primary text-primary-foreground",
};

export function generateCode(length = 5) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function elapsedSeconds(from: string | null, to: string | null = null) {
  if (!from) return 0;
  const end = to ? new Date(to).getTime() : Date.now();
  return Math.floor((end - new Date(from).getTime()) / 1000);
}
