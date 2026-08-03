import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { usePendingAction } from "@/hooks/usePendingAction";
import { elapsedSeconds, formatDuration, TEAM_SWATCH, type GameSession, type Submission, type Team } from "@/lib/db";
import { typeMeta, type Mission } from "@/lib/missions";

export const Route = createFileRoute("/_authenticated/live/$id")({
  head: () => ({
    meta: [
      { title: "Torazen Playroom" },
      { name: "description", content: "Follow every team in real time, approve answers and control the game." },
      { property: "og:title", content: "Torazen Playroom" },
      { property: "og:description", content: "Follow every team in real time and control the game." },
    ],
  }),
  component: LiveDashboard,
});

function LiveDashboard() {
  const { id } = Route.useParams();
  const { t, dir } = useI18n();
  const qc = useQueryClient();
  const { run, isPending } = usePendingAction();
  const [announcement, setAnnouncement] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const i = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(i);
  }, []);

  const session = useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("game_sessions").select("*").eq("id", id).single();
      if (error) throw error;
      return data as unknown as GameSession;
    },
  });

  const missions = useQuery({
    queryKey: ["session-missions", session.data?.pack_id],
    enabled: Boolean(session.data?.pack_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .eq("pack_id", session.data!.pack_id)
        .order("order_index");
      if (error) throw error;
      return data as unknown as Mission[];
    },
  });

  const teams = useQuery({
    queryKey: ["session-teams", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").eq("session_id", id).order("joined_at");
      if (error) throw error;
      return data as unknown as Team[];
    },
  });

  const submissions = useQuery({
    queryKey: ["session-subs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("session_id", id)
        .eq("status", "pending")
        .order("created_at");
      if (error) throw error;
      return data as unknown as Submission[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`live-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `session_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["session-teams", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions", filter: `session_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["session-subs", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["session", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const total = missions.data?.length ?? 0;
  const missionById = useMemo(() => new Map((missions.data ?? []).map((m) => [m.id, m])), [missions.data]);
  const teamById = useMemo(() => new Map((teams.data ?? []).map((tm) => [tm.id, tm])), [teams.data]);
  const s = session.data;

  async function updateSession(patch: Partial<GameSession>) {
    const { error } = await supabase.from("game_sessions").update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["session", id] });
  }

  async function updateTeam(team: Team, patch: Partial<Team>) {
    const { error } = await supabase
      .from("teams")
      .update({ ...(patch as Record<string, unknown>), last_activity: new Date().toISOString() } as never)
      .eq("id", team.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["session-teams", id] });
  }

  async function resolveSubmission(sub: Submission, approved: boolean) {
    const team = teamById.get(sub.team_id);
    const mission = missionById.get(sub.mission_id);
    const { error } = await supabase.from("submissions").update({ status: approved ? "approved" : "rejected" } as never).eq("id", sub.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    if (approved && team && mission) {
      await updateTeam(team, {
        score: team.score + mission.points,
        current_index: team.current_index + 1,
        completed: [...(team.completed ?? []), mission.id],
      });
    }
    qc.invalidateQueries({ queryKey: ["session-subs", id] });
  }

  const ranked = [...(teams.data ?? [])].sort((a, b) => b.score - a.score || b.current_index - a.current_index);

  return (
    <div dir={dir} className="min-h-screen bg-background">
      <header className="border-b-2 border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/teacher" className="font-display text-lg font-extrabold">
            ← {t("back")}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <section className="card-playful flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h1 className="font-display text-3xl font-extrabold">{s?.title ?? t("loading")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("shareCode")} · {s ? t(s.mode) : ""} · {s ? Math.round(s.timer_seconds / 60) : 0} min
            </p>
          </div>
          <div className="rounded-3xl bg-sunny-gradient px-6 py-3 text-center shadow-pop">
            <div className="text-xs font-bold uppercase text-sunny-foreground">{t("code")}</div>
            <div className="font-display text-4xl font-extrabold tracking-[0.3em] text-sunny-foreground">{s?.code}</div>
          </div>
        </section>

        <section className="flex flex-wrap gap-2">
          {s?.status === "lobby" && (
            <Button
              className="rounded-full font-extrabold shadow-pop"
              disabled={isPending("start")}
              onClick={() => void run("start", () => updateSession({ status: "running", started_at: new Date().toISOString() }))}
            >
              {isPending("start") ? <Loader2 className="animate-spin" /> : null}
              ▶ {t("start")}
            </Button>
          )}
          {s?.status === "running" && (
            <Button variant="secondary" className="rounded-full font-bold" disabled={isPending("pause")} onClick={() => void run("pause", () => updateSession({ status: "paused" }))}>
              {isPending("pause") ? <Loader2 className="animate-spin" /> : null}
              ⏸ {t("pause")}
            </Button>
          )}
          {s?.status === "paused" && (
            <Button className="rounded-full font-bold" disabled={isPending("resume")} onClick={() => void run("resume", () => updateSession({ status: "running" }))}>
              {isPending("resume") ? <Loader2 className="animate-spin" /> : null}
              ▶ {t("resume")}
            </Button>
          )}
          {s?.status !== "finished" && (
            <Button
              variant="destructive"
              className="rounded-full font-bold"
              disabled={isPending("finish")}
              onClick={() => void run("finish", () => updateSession({ status: "finished", finished_at: new Date().toISOString() }))}
            >
              {isPending("finish") ? <Loader2 className="animate-spin" /> : null}
              🏁 {t("finish")}
            </Button>
          )}
        </section>

        <section className="card-playful p-5">
          <h2 className="font-display text-lg font-extrabold">{t("announce")}</h2>
          <div className="mt-3 flex gap-2">
            <Input
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder={t("announcement")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const msg = announcement;
                  void run("announce", async () => {
                    await updateSession({ announcement: msg });
                    setAnnouncement("");
                  });
                }
              }}
            />
            <Button
              className="rounded-full font-bold"
              disabled={isPending("announce")}
              onClick={() =>
                void run("announce", async () => {
                  await updateSession({ announcement });
                  setAnnouncement("");
                })
              }
            >
              {isPending("announce") ? <Loader2 className="animate-spin" /> : null}
              {t("send")}
            </Button>
          </div>
        </section>

        {(submissions.data?.length ?? 0) > 0 && (
          <section className="card-playful border-coral p-5">
            <h2 className="font-display text-lg font-extrabold">🙋 {t("pending")}</h2>
            <ul className="mt-3 space-y-3">
              {submissions.data?.map((sub) => {
                const team = teamById.get(sub.team_id);
                const mission = missionById.get(sub.mission_id);
                return (
                  <li key={sub.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted p-3">
                    <div>
                      <p className="font-bold">
                        {team?.name} — {mission?.title}
                      </p>
                      <p className="text-sm text-muted-foreground">{sub.answer}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-full font-bold"
                        disabled={isPending(`approve-${sub.id}`) || isPending(`reject-${sub.id}`)}
                        onClick={() => void run(`approve-${sub.id}`, () => resolveSubmission(sub, true))}
                      >
                        {isPending(`approve-${sub.id}`) ? <Loader2 className="animate-spin" /> : null}
                        ✅ {t("approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full font-bold"
                        disabled={isPending(`approve-${sub.id}`) || isPending(`reject-${sub.id}`)}
                        onClick={() => void run(`reject-${sub.id}`, () => resolveSubmission(sub, false))}
                      >
                        {isPending(`reject-${sub.id}`) ? <Loader2 className="animate-spin" /> : null}
                        ✖ {t("reject")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <h2 className="font-display text-xl font-extrabold">
            {t("teams")} <span className="text-muted-foreground">({ranked.length})</span>
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {ranked.map((team, index) => {
              const mission = (missions.data ?? [])[team.current_index];
              const done = team.completed?.length ?? 0;
              return (
                <article key={team.id} className="card-playful animate-pop-in p-5" data-tick={tick}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-display text-lg font-extrabold">
                      <span className={`inline-flex size-8 items-center justify-center rounded-full ${TEAM_SWATCH[team.color] ?? TEAM_SWATCH.sky}`}>
                        {index + 1}
                      </span>
                      {team.name}
                    </h3>
                    <Badge className="font-display text-base">{team.score} pts</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {mission ? `${typeMeta(mission.type).icon} ${mission.title}` : t("finished")}
                  </p>
                  <Progress value={total ? (done / total) * 100 : 0} className="mt-3 h-3" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {done}/{total} · ⏱ {formatDuration(elapsedSeconds(s?.started_at ?? null, s?.status === "finished" ? s?.finished_at : null))}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="rounded-full" disabled={isPending(`points-${team.id}`)} onClick={() => void run(`points-${team.id}`, () => updateTeam(team, { score: team.score + 5 }))}>
                      {isPending(`points-${team.id}`) ? <Loader2 className="animate-spin" /> : null}
                      {t("addPoints")}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full" disabled={isPending(`points-${team.id}`)} onClick={() => void run(`points-${team.id}`, () => updateTeam(team, { score: team.score - 5 }))}>
                      {isPending(`points-${team.id}`) ? <Loader2 className="animate-spin" /> : null}
                      {t("removePoints")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={isPending(`skip-${team.id}`)}
                      onClick={() => void run(`skip-${team.id}`, () => updateTeam(team, { current_index: team.current_index + 1 }))}
                    >
                      {isPending(`skip-${team.id}`) ? <Loader2 className="animate-spin" /> : null}
                      ⏭ {t("skip")}
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={isPending(`unlock-${team.id}`) || !mission}
                      onClick={() =>
                        mission &&
                        void run(`unlock-${team.id}`, () =>
                          updateTeam(team, {
                            current_index: team.current_index + 1,
                            score: team.score + mission.points,
                            completed: [...(team.completed ?? []), mission.id],
                          }),
                        )
                      }
                    >
                      {isPending(`unlock-${team.id}`) ? <Loader2 className="animate-spin" /> : null}
                      🔓 {t("unlock")}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {s?.status === "finished" && (
          <section className="card-playful bg-sunny-gradient p-6">
            <h2 className="font-display text-2xl font-extrabold text-sunny-foreground">🏆 {t("leaderboard")}</h2>
            <ol className="mt-4 space-y-2">
              {ranked.map((team, i) => (
                <li key={team.id} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 font-bold">
                  <span>
                    {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {team.name}
                  </span>
                  <span>{team.score} pts</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}
