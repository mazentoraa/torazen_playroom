# Clever Game — Classroom Challenge Platform

A live classroom quiz game for teachers and students. A teacher builds a **quiz pack** of missions, launches a **game session** with a short join code, and students join on their phones as **teams** and race to complete the missions. Teachers can watch progress live, approve answers, add or remove points, and unlock missions.

Supported languages: English, French, Arabic (RTL).

## How it works

1. **Teacher signs up** → creates quiz packs in the pack editor.
2. Each pack contains **missions** — anything from multiple choice and text answers to ordering, matching, QR code challenges, or image uploads. Some answers are checked automatically; others need teacher approval.
3. The teacher starts a **live session**, which gets a unique code (e.g. `ABC12`). Packs can be exported to Markdown/JSON and imported back (great for generating questions in ChatGPT).
4. **Students** open the app, enter the code, pick a team, and work through the missions. Progress and scores sync live through Supabase Realtime.
5. The teacher dashboard shows every team's score, progress bar, pending submissions to approve, and controls to pause/resume/finish the game. When the session finishes, a leaderboard is shown.

## Tech stack

- **TanStack Start** (React 19, file-based routing, SSR) — the whole app is routes + components.
- **Tailwind CSS v4** — styling, with a playful design system in `src/styles.css`.
- **Supabase** — Postgres database, Auth (teacher accounts), and Realtime (live sync of teams, submissions, and session state).
- **Vite** — build tooling. Production build is bundled for **Nitro / Cloudflare Workers**.
- **sonner** toasts + **lucide-react** icons for UI feedback.

## Project structure

```
src/
  routes/                 File-based routes (TanStack Start)
    index.tsx             Landing page — join by code
    auth.tsx              Teacher sign in / sign up
    _authenticated/
      teacher.tsx         Teacher dashboard: packs & sessions
      packs.$id.tsx       Pack editor: missions, markdown import/export
      live.$id.tsx        Live game dashboard: realtime controls + leaderboard
    play.$code.tsx        Player screen: join a team, answer missions
  components/ui/          Reusable UI primitives (buttons, dialogs, inputs, …)
  hooks/                  e.g. usePendingAction (prevents double submits)
  lib/                    i18n (en/fr/ar), mission engine, markdown, db helpers
  integrations/supabase/  Supabase client + auth middleware (+ generated types)
supabase/migrations/      Database schema (tables, RLS policies, realtime)
```

## Database

The schema lives in `supabase/migrations/` and covers six tables: `profiles`, `quiz_packs`, `missions`, `game_sessions`, `teams`, and `submissions`. All queries go through **Row Level Security**: teachers own their packs/sessions, while sessions/teams/submissions are publicly readable so players can join. Realtime is enabled on sessions, teams, and submissions.

## Running locally

1. `npm install`
2. Create a Supabase project and apply the migrations in `supabase/migrations/`.
3. Fill in `.env` (see `.env.example`-style values in the current `.env`: project URL + publishable/anon key).
4. (Optional) To enable **AI quiz generation** (`✨ Generate with AI` on the teacher dashboard / pack editor), set `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini) or `OPENAI_API_KEY` (OpenAI). Options: `AI_MODEL` (defaults: `gemini-3.6-flash` / `gpt-4o-mini`), `AI_PROVIDER` (`auto` | `google` | `openai`), or `AI_BASE_URL` for a compatible proxy.
5. `npm run dev` → open http://localhost:3000

## Notes for collaborators

- Do not hand-edit generated files: `src/routeTree.gen.ts`, `src/integrations/supabase/types.ts`.
- `.env` holds secrets — never commit real keys. Prefer `src/lib/` and routes for changes.
- All user-facing strings go through the i18n dictionaries in `src/lib/i18n.tsx` (en/fr/ar).
- Async buttons should use `usePendingAction` to avoid duplicate clicks / double submits.
- Lint: `npm run lint` (repo files use CRLF line endings, so prettier may flag `Delete ␍` on untouched files — that's pre-existing noise).
