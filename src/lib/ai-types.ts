import { z } from "zod";

export const generationSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  count: z.number().int().min(1).max(30),
  language: z.enum(["en", "fr", "ar"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  allowManual: z.boolean(),
});

export type GenerationPreferences = z.infer<typeof generationSchema>;
export type GeneratedLanguage = GenerationPreferences["language"];
export type GeneratedDifficulty = GenerationPreferences["difficulty"];
