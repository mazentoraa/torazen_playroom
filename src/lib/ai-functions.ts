import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generationSchema, type GenerationPreferences } from "@/lib/ai-types";
import type { ParsedPack } from "@/lib/markdown";

/**
 * Generates a quiz pack from a teacher's prompt + preferences.
 * The heavy AI/provider code lives in `@/lib/ai.server` and is only imported
 * dynamically here so it never ends up in the client bundle.
 */
export const generatePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(generationSchema)
  .handler(async ({ data, context }): Promise<ParsedPack> => {
    const auth = context as { userId: string };
    const prefs: GenerationPreferences = data;
    const { generatePackMarkdown } = await import("@/lib/ai.server");
    try {
      return await generatePackMarkdown(prefs, auth.userId);
    } catch (error) {
      console.error("[ai] generation failed", error);
      const message = error instanceof Error ? error.message : "AI generation failed.";
      throw new Error(message);
    }
  });
