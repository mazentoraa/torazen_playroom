import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { usePendingAction } from "@/hooks/usePendingAction";
import { celebrate, buzzSound } from "@/lib/celebrate";
import { elapsedSeconds, formatDuration, TEAM_SWATCH, type GameSession, type Team } from "@/lib/db";
import { checkAnswer, needsTeacher, orderMissions, typeMeta, type Mission } from "@/lib/missions";

export const Route = createFileRoute("/play/$code")({
  head: () => ({
    meta: [
      { title: "Torazen Playroom" },
      { name: "description", content: "Join your team, solve missions and race to the top of the classroom leaderboard." },
      { property: "og:title", content: "Play the challenge" },
      { property: "og:description", content: "Join your team and solve missions live." },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  const { code } = Route.useParams();
  const { t, dir } = useI18n();
  const { run, isPending } = usePendingAction();

  const [session, setSession] = useState<GameSession | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");
  const [hintIndex, setHintIndex] = useState(0);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lastAnnouncement = useRef<string | null>(null);

  const storageKey = `ccp-team-${code}`;

  const loadAll = useCallback(async () => {
    const { data: sess } = await supabase.from("game_sessions").select("*").eq("code", code.toUpperCase()).maybeSingle();
    if (!sess) {
      setLoading(false);
      return;
    }
    const s = sess as unknown as GameSession;
    setSession(s);
    const [{ data: tm }, { data: ms }] = await Promise.all([
      supabase.from("teams").select("*").eq("session_id", s.id).order("joined_at"),
      supabase.from("missions").select("*").eq("pack_id", s.pack_id).order("order_index"),
    ]);
    setTeams((tm ?? []) as unknown as Team[]);
    setMissions((ms ?? []) as unknown as Mission[]);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    void loadAll();
    const stored = localStorage.getItem(storageKey);
    if (stored) setTeamId(stored);
  }, [loadAll, storageKey]);

  useEffect(() => {
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`play-${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `session_id=eq.${session.id}` }, () => {
        void loadAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${session.id}` }, () => {
        void loadAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `session_id=eq.${session.id}` }, () => {
        void loadAll();
        setPendingApproval(false);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id, loadAll, session]);

  useEffect(() => {
    if (session?.announcement && session.announcement !== lastAnnouncement.current) {
      lastAnnouncement.current = session.announcement;
      if (session.announcement.trim()) toast(`${session.announcement}`, { duration: 8000 });
    }
  }, [session?.announcement, session]);

  const team = teams.find((x) => x.id === teamId) ?? null;

  const ordered = useMemo(
    () => (session ? orderMissions(missions, session.mode, session.randomize, team?.id ?? session.id) : []),
    [missions, session, team?.id],
  );
  const mission = team ? ordered[team.current_index] : undefined;
  const total = ordered.length;

  const remaining = session?.started_at
    ? Math.max(0, session.timer_seconds - Math.floor((now - new Date(session.started_at).getTime()) / 1000))
    : (session?.timer_seconds ?? 0);

  async function pickTeam(id: string) {
    localStorage.setItem(storageKey, id);
    setTeamId(id);
  }

  async function advance(points: number, missionId: string) {
    if (!team) return;
    const { error } = await supabase
      .from("teams")
      .update({
        score: team.score + points,
        current_index: team.current_index + 1,
        completed: [...(team.completed ?? []), missionId],
        last_activity: new Date().toISOString(),
      } as never)
      .eq("id", team.id);
    if (error) toast.error(error.message);
    else await loadAll();
  }

  async function submit() {
    if (!mission || !team || !session) return;
    if (needsTeacher(mission)) {
      const { error } = await supabase.from("submissions").insert({
        session_id: session.id,
        team_id: team.id,
        mission_id: mission.id,
        answer,
      } as never);
      if (error) {
        toast.error(error.message);
        return;
      }

      setPendingApproval(true);
      setAnswer("");
      toast.success(t("sentForValidation"));
      return;
    }
    if (checkAnswer(mission, answer)) {
      const penalty = hintIndex * (session.hint_penalty ?? 0);
      celebrate();
      toast.success(t("correct"));
      setAnswer("");
      setHintIndex(0);
      await advance(Math.max(0, mission.points - penalty), mission.id);
    } else {
      buzzSound();
      toast.error(t("wrong"));
    }
  }

  if (loading) {
    return <CenterCard dir={dir}>{t("loading")}</CenterCard>;
  }

  if (!session) {
    return (
      <CenterCard dir={dir}>
        <p className="font-display text-xl font-extrabold">🤔 {code}</p>
        <p className="mt-2 text-muted-foreground">{t("enterCode")}</p>
        <Button asChild className="mt-4 rounded-full font-bold">
          <Link to="/">{t("back")}</Link>
        </Button>
      </CenterCard>
    );
  }

  if (!team) {
    return (
      <div dir={dir} className="min-h-screen bg-hero px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex justify-end">
            <LanguageSwitcher />
          </div>
          <div className="card-playful animate-pop-in p-6">
            <h1 className="font-display text-2xl font-extrabold">{session.title}</h1>
            <p className="mt-1 text-muted-foreground">{t("pickTeam")}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {teams.map((tm) => (
                <button
                  key={tm.id}
                  onClick={() => pickTeam(tm.id)}
                  className={`rounded-3xl p-5 text-start font-display text-lg font-extrabold shadow-pop transition-transform hover:scale-[1.02] ${TEAM_SWATCH[tm.color] ?? TEAM_SWATCH.sky}`}
                >
                  {tm.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const finishedAll = team.current_index >= total;
  const ranked = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div dir={dir} className="min-h-screen bg-hero pb-16">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className={`rounded-full px-4 py-2 font-display text-lg font-extrabold shadow-pop ${TEAM_SWATCH[team.color] ?? TEAM_SWATCH.sky}`}>
          {team.name}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="font-display text-base">⭐ {team.score}</Badge>
          <Badge variant="secondary" className="font-display text-base">
            ⏱ {formatDuration(remaining)}
          </Badge>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        <Progress value={total ? (team.current_index / total) * 100 : 0} className="h-4 rounded-full" />
        <p className="mt-2 text-sm font-bold text-primary-foreground">
          {Math.min(team.current_index, total)}/{total} {t("missions")}
        </p>

        {session.status === "lobby" && <Banner emoji="⏳">{t("waitingStart")}</Banner>}
        {session.status === "paused" && <Banner emoji="⏸">{t("gamePaused")}</Banner>}

        {session.status === "finished" || finishedAll ? (
          <section className="card-playful mt-6 animate-pop-in p-6 text-center">
            <h2 className="font-display text-3xl font-extrabold">
              {session.status === "finished" ? `🏁 ${t("gameOver")}` : `${t("finished")}`}
            </h2>
            <p className="mt-2 text-lg font-bold">
              {t("yourScore")}: {team.score}
            </p>
            <ol className="mt-5 space-y-2 text-start">
              {ranked.map((tm, i) => (
                <li
                  key={tm.id}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 font-bold ${tm.id === team.id ? "bg-accent" : "bg-muted"}`}
                >
                  <span>
                    {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {tm.name}
                  </span>
                  <span>{tm.score} pts</span>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          mission &&
          session.status === "running" && (
            <section key={mission.id} className="card-playful mt-6 animate-pop-in p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-3xl" aria-hidden="true">
                  {typeMeta(mission.type).icon}
                </span>
                <h2 className="font-display text-2xl font-extrabold">{mission.title}</h2>
                <Badge variant="secondary">{mission.points} pts</Badge>
                {mission.category && <Badge>{mission.category}</Badge>}
              </div>

              {mission.question && <p className="mt-3 whitespace-pre-line text-lg font-semibold">{mission.question}</p>}

              {mission.media_url && <MissionMedia url={mission.media_url} type={mission.media_type} label={t("openLink")} />}

              {pendingApproval ? (
                <p className="mt-6 animate-float text-center font-display text-xl font-extrabold">{t("waitingTeacher")}</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {mission.type === "multiple_choice" && mission.choices?.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {mission.choices.map((choice) => (
                        <Button
                          key={choice}
                          variant={answer === choice ? "default" : "outline"}
                          className="h-auto justify-start rounded-2xl py-4 text-start text-base font-bold whitespace-normal"
                          onClick={() => setAnswer(choice)}
                        >
                          {choice}
                        </Button>
                      ))}
                    </div>
                  )}

                  {mission.type === "true_false" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={answer === "true" ? "default" : "outline"}
                        className="h-16 rounded-2xl text-lg font-extrabold"
                        onClick={() => setAnswer("true")}
                      >
                        ✅ {t("trueLabel")}
                      </Button>
                      <Button
                        variant={answer === "false" ? "default" : "outline"}
                        className="h-16 rounded-2xl text-lg font-extrabold"
                        onClick={() => setAnswer("false")}
                      >
                        ❌ {t("falseLabel")}
                      </Button>
                    </div>
                  )}

                  {(mission.type === "ordering" || mission.type === "matching") && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {mission.type === "ordering" ? t("orderHint") : t("matchHint")}
                      </p>
                      {mission.choices?.length > 0 && (
                        <ul className="flex flex-wrap gap-2">
                          {mission.choices.map((c) => (
                            <li key={c}>
                              <Badge variant="secondary" className="text-sm">
                                {c}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        rows={4}
                        className="rounded-2xl text-base"
                      />
                    </>
                  )}

                  {["text", "number", "password", "qr_code", "image_question", "custom", "google_earth", "external", "video", "human_benchmark", "teacher_validation", "image_upload"].includes(
                    mission.type,
                  ) && (
                    <Input
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      inputMode={mission.type === "number" ? "decimal" : "text"}
                      placeholder={
                        mission.type === "password" || mission.type === "qr_code"
                          ? "🔑 " + t("password")
                          : mission.type === "image_upload"
                            ? t("uploadImage")
                            : t("answer")
                      }
                      className="h-16 rounded-2xl text-center font-display text-2xl font-extrabold"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void run("submit", submit);
                      }}
                    />
                  )}

                  <Button
                    onClick={() => void run("submit", submit)}
                    disabled={isPending("submit")}
                    className="h-14 w-full rounded-2xl text-lg font-extrabold shadow-pop"
                  >
                    {isPending("submit") ? <Loader2 className="animate-spin" /> : null}
                    {t("submit")} →
                  </Button>

                  {mission.hints?.length > 0 && (
                    <div className="rounded-2xl bg-muted p-4">
                      {mission.hints.slice(0, hintIndex).map((h) => (
                        <p key={h} className="font-semibold">
                          💡 {h}
                        </p>
                      ))}
                      {hintIndex < mission.hints.length && (
                        <Button
                          variant="ghost"
                          className="rounded-full font-bold"
                          onClick={() => setHintIndex((i) => i + 1)}
                        >
                          💡 {t("showHint")} (−{session.hint_penalty} pts)
                        </Button>
                      )}
                    </div>
                  )}

                  {mission.allow_skip && (
                    <Button
                      variant="ghost"
                      disabled={isPending("skip")}
                      className="w-full rounded-full text-muted-foreground"
                      onClick={() => void run("skip", () => advance(0, mission.id))}
                    >
                      {isPending("skip") ? <Loader2 className="animate-spin" /> : null}
                      ⏭ {t("skip")}
                    </Button>
                  )}
                </div>
              )}
            </section>
          )
        )}
      </main>
    </div>
  );
}

function Banner({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <div className="card-playful mt-6 animate-float p-6 text-center font-display text-xl font-extrabold">
      <span aria-hidden="true">{emoji}</span> {children}
    </div>
  );
}

function MissionMedia({ url, type, label }: { url: string; type: string | null; label: string }) {
  const isImage = type === "image" || /\.(png|jpe?g|gif|webp|svg)$/i.test(url);
  const isVideo = type === "video" || /youtube\.com|youtu\.be|vimeo\.com|\.mp4$/i.test(url);
  const isAudio = type === "audio" || /\.(mp3|ogg|wav)$/i.test(url);

  if (isImage) {
    return <img src={url} alt="" loading="lazy" className="mt-4 w-full rounded-3xl border-2 border-border object-cover" />;
  }
  if (isAudio) {
    return <audio controls src={url} className="mt-4 w-full" />;
  }
  if (isVideo && /\.mp4$/i.test(url)) {
    return <video controls src={url} className="mt-4 w-full rounded-3xl" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 inline-flex rounded-full bg-secondary px-5 py-3 font-bold text-secondary-foreground"
    >
      🔗 {label}
    </a>
  );
}

function CenterCard({ children, dir }: { children: React.ReactNode; dir: "ltr" | "rtl" }) {
  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-hero px-4">
      <div className="card-playful animate-pop-in p-8 text-center">{children}</div>
    </div>
  );
}
