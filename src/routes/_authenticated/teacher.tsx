import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { usePendingAction } from "@/hooks/usePendingAction";
import { generateCode, TEAM_COLORS, type GameSession, type QuizPack } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher dashboard | Torazen Playroom" },
      { name: "description", content: "Manage reusable quiz packs and launch live classroom game sessions." },
      { property: "og:title", content: "Teacher dashboard | Torazen Playroom" },
      { property: "og:description", content: "Manage quiz packs and launch live classroom game sessions." },
    ],
  }),
  component: TeacherDashboard,
});

function TeacherDashboard() {
  const { t, dir } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { run: runSignOut, isPending: isSigningOut } = usePendingAction();

  const packs = useQuery({
    queryKey: ["packs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quiz_packs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as QuizPack[];
    },
  });

  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("game_sessions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as GameSession[];
    },
  });

  const createPack = useMutation({
    mutationFn: async (values: { title: string; description: string; language: string }) => {
      const { data, error } = await supabase
        .from("quiz_packs")
        .insert({ ...values, owner_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as QuizPack;
    },
    onSuccess: (pack) => {
      qc.invalidateQueries({ queryKey: ["packs"] });
      navigate({ to: "/packs/$id", params: { id: pack.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePack = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quiz_packs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packs"] });
      toast.success(t("deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("game_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      toast.success(t("deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div dir={dir} className="min-h-screen bg-background">
      <header className="border-b-2 border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="font-display text-xl font-extrabold">
            {t("appName")}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="outline"
              disabled={isSigningOut("signout")}
              className="rounded-full font-bold"
              onClick={() =>
                void runSignOut("signout", async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                })
              }
            >
              {isSigningOut("signout") ? <Loader2 className="animate-spin" /> : null}
              {t("signOut")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Tabs defaultValue="packs">
          <TabsList className="rounded-full">
            <TabsTrigger value="packs" className="rounded-full font-bold">
              {t("quizPacks")}
            </TabsTrigger>
            <TabsTrigger value="sessions" className="rounded-full font-bold">
              {t("sessions")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="packs" className="mt-6">
            <div className="mb-4 flex justify-end">
              <NewPackDialog pending={createPack.isPending} onCreate={(v) => createPack.mutate(v)} />
            </div>
            {packs.data?.length === 0 && <p className="text-muted-foreground">{t("noPacks")}</p>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packs.data?.map((p) => (
                <div key={p.id} className="card-playful animate-pop-in p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-extrabold">{p.title}</h3>
                    <Badge variant="secondary" className="uppercase">
                      {p.language}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-4 flex gap-2">
                    <Button asChild size="sm" className="rounded-full font-bold">
                      <Link to="/packs/$id" params={{ id: p.id }}>
                        {t("edit")}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-destructive"
                      disabled={deletePack.isPending}
                      onClick={() => deletePack.mutate(p.id)}
                    >
                      {deletePack.isPending ? <Loader2 className="animate-spin" /> : null}
                      {t("delete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="mt-6">
            <div className="mb-4 flex justify-end">
              <NewSessionDialog packs={packs.data ?? []} />
            </div>
            {sessions.data?.length === 0 && <p className="text-muted-foreground">{t("noSessions")}</p>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.data?.map((s) => (
                <div key={s.id} className="card-playful animate-pop-in p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-extrabold">{s.title}</h3>
                    <Badge className="font-display text-base tracking-widest">{s.code}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(s.mode)} · {Math.round(s.timer_seconds / 60)} min · {s.status}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button asChild size="sm" className="rounded-full font-bold">
                      <Link to="/live/$id" params={{ id: s.id }}>
                        {t("liveBoard")}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-destructive"
                      disabled={deleteSession.isPending}
                      onClick={() => deleteSession.mutate(s.id)}
                    >
                      {deleteSession.isPending ? <Loader2 className="animate-spin" /> : null}
                      {t("delete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function NewPackDialog({ pending, onCreate }: { pending: boolean; onCreate: (v: { title: string; description: string; language: string }) => void }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<string>(lang);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full font-extrabold shadow-pop">+ {t("newPack")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newPack")}</DialogTitle>
          <DialogDescription>{t("markdownHelp")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("language")}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!title.trim() || pending}
            className="rounded-full font-bold"
            onClick={() => {
              onCreate({ title: title.trim(), description, language });
              setOpen(false);
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewSessionDialog({ packs }: { packs: QuizPack[] }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [packId, setPackId] = useState<string>("");
  const [mode, setMode] = useState("sequential");
  const [minutes, setMinutes] = useState(30);
  const [teamCount, setTeamCount] = useState(4);
  const [randomize, setRandomize] = useState(false);
  const [hintPenalty, setHintPenalty] = useState(2);

  useEffect(() => {
    if (!packId && packs[0]) setPackId(packs[0].id);
  }, [packs, packId]);

  const disabled = useMemo(() => !title.trim() || !packId, [title, packId]);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("game_sessions")
        .insert({
          owner_id: user!.id,
          pack_id: packId,
          title: title.trim(),
          code: generateCode(),
          mode,
          language: lang,
          timer_seconds: minutes * 60,
          randomize,
          hint_penalty: hintPenalty,
        })
        .select()
        .single();
      if (error) throw error;
      const session = data as unknown as GameSession;
      const teams = Array.from({ length: teamCount }, (_, i) => ({
        session_id: session.id,
        name: `${t("team")} ${i + 1}`,
        color: TEAM_COLORS[i % TEAM_COLORS.length],
      }));
      const { error: teamErr } = await supabase.from("teams").insert(teams);
      if (teamErr) throw teamErr;
      return session;
    },
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setOpen(false);
      navigate({ to: "/live/$id", params: { id: session.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full font-extrabold shadow-pop">+ {t("newSession")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("newSession")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("pack")}</Label>
            <Select value={packId} onValueChange={setPackId}>
              <SelectTrigger>
                <SelectValue placeholder={t("pack")} />
              </SelectTrigger>
              <SelectContent>
                {packs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("mode")}</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">{t("sequential")}</SelectItem>
                <SelectItem value="random">{t("random")}</SelectItem>
                <SelectItem value="categories">{t("categories")}</SelectItem>
                <SelectItem value="treasure">{t("treasure")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t("timer")}</Label>
              <Input type="number" min={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("teamsCount")}</Label>
              <Input type="number" min={1} max={12} value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("hintPenalty")}</Label>
              <Input type="number" min={0} value={hintPenalty} onChange={(e) => setHintPenalty(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border-2 border-border p-3">
            <Label htmlFor="rand">{t("randomize")}</Label>
            <Switch id="rand" checked={randomize} onCheckedChange={setRandomize} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={disabled || create.isPending} className="rounded-full font-bold" onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
