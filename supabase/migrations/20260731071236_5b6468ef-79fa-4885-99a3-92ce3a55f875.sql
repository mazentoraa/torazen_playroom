
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.quiz_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.quiz_packs(id) ON DELETE CASCADE,
  order_index int NOT NULL DEFAULT 0,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  category text DEFAULT '',
  question text DEFAULT '',
  media_url text,
  media_type text,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer jsonb,
  password text,
  hints jsonb NOT NULL DEFAULT '[]'::jsonb,
  points int NOT NULL DEFAULT 10,
  time_bonus int NOT NULL DEFAULT 0,
  allow_skip boolean NOT NULL DEFAULT false,
  requires_validation boolean NOT NULL DEFAULT false,
  explanation text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.quiz_packs(id) ON DELETE CASCADE,
  title text NOT NULL,
  code text NOT NULL UNIQUE,
  mode text NOT NULL DEFAULT 'sequential',
  language text NOT NULL DEFAULT 'en',
  timer_seconds int NOT NULL DEFAULT 1800,
  randomize boolean NOT NULL DEFAULT false,
  hint_penalty int NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'lobby',
  announcement text DEFAULT '',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'sky',
  score int NOT NULL DEFAULT 0,
  current_index int NOT NULL DEFAULT 0,
  completed jsonb NOT NULL DEFAULT '[]'::jsonb,
  hints_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  finished_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  answer text DEFAULT '',
  media_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_packs TO authenticated;
GRANT SELECT ON public.quiz_packs TO anon;
GRANT ALL ON public.quiz_packs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions TO authenticated;
GRANT SELECT ON public.missions TO anon;
GRANT ALL ON public.missions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_sessions TO authenticated;
GRANT SELECT ON public.game_sessions TO anon;
GRANT ALL ON public.game_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.teams TO anon;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT SELECT, INSERT ON public.submissions TO anon;
GRANT ALL ON public.submissions TO service_role;

ALTER TABLE public.quiz_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own packs" ON public.quiz_packs FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "packs used in a session are readable" ON public.quiz_packs FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.pack_id = quiz_packs.id));

CREATE POLICY "own missions" ON public.missions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.quiz_packs p WHERE p.id = missions.pack_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.quiz_packs p WHERE p.id = missions.pack_id AND p.owner_id = auth.uid()));
CREATE POLICY "missions in a session are readable" ON public.missions FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.pack_id = missions.pack_id));

CREATE POLICY "own sessions" ON public.game_sessions FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "sessions are publicly readable" ON public.game_sessions FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "teacher manages teams" ON public.teams FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = teams.session_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = teams.session_id AND s.owner_id = auth.uid()));
CREATE POLICY "teams readable" ON public.teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "teams joinable" ON public.teams FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "teams updatable in live session" ON public.teams FOR UPDATE TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = teams.session_id AND s.status <> 'finished'))
WITH CHECK (true);

CREATE POLICY "teacher manages submissions" ON public.submissions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = submissions.session_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = submissions.session_id AND s.owner_id = auth.uid()));
CREATE POLICY "submissions readable" ON public.submissions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "submissions insertable" ON public.submissions FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX ON public.missions (pack_id, order_index);
CREATE INDEX ON public.teams (session_id);
CREATE INDEX ON public.submissions (session_id, status);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
