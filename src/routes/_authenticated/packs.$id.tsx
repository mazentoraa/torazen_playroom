import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { MISSION_TYPES, typeMeta, type Mission, type MissionType } from "@/lib/missions";
import { downloadFile, MARKDOWN_TEMPLATE, parseMarkdown, toMarkdown, type ParsedMission } from "@/lib/markdown";
import type { QuizPack } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/packs/$id")({
  head: () => ({
    meta: [
      { title: "Quiz pack editor | Torazen Playroom" },
      { name: "description", content: "Edit missions, import markdown from ChatGPT and export reusable quiz packs." },
      { property: "og:title", content: "Quiz pack editor | Torazen Playroom" },
      { property: "og:description", content: "Edit missions and import markdown quiz packs." },
    ],
  }),
  component: PackEditor,
});

const toParsed = (m: Mission): ParsedMission => ({
  title: m.title,
  type: m.type,
  category: m.category ?? "",
  question: m.question ?? "",
  media_url: m.media_url,
  media_type: m.media_type,
  choices: m.choices ?? [],
  answer: (m.answer as string[] | string | null) ?? null,
  password: m.password,
  hints: m.hints ?? [],
  points: m.points,
  time_bonus: m.time_bonus,
  allow_skip: m.allow_skip,
  requires_validation: m.requires_validation,
  explanation: m.explanation ?? "",
});

function PackEditor() {
  const { id } = Route.useParams();
  const { t, dir } = useI18n();
  const qc = useQueryClient();

  const pack = useQuery({
    queryKey: ["pack", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("quiz_packs").select("*").eq("id", id).single();
      if (error) throw error;
      return data as unknown as QuizPack;
    },
  });

  const missions = useQuery({
    queryKey: ["missions", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("missions").select("*").eq("pack_id", id).order("order_index");
      if (error) throw error;
      return data as unknown as Mission[];
    },
  });

  const saveMission = useMutation({
    mutationFn: async (m: Partial<Mission> & { id?: string }) => {
      if (m.id) {
        const { id: mid, ...rest } = m;
        const { error } = await supabase.from("missions").update(rest as never).eq("id", mid);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("missions").insert({ ...(m as Record<string, unknown>), pack_id: id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missions", id] });
      toast.success(t("save"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMission = useMutation({
    mutationFn: async (mid: string) => {
      const { error } = await supabase.from("missions").delete().eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["missions", id] });
      toast.success(t("deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMissions = useMutation({
    mutationFn: async ({ parsed, replace }: { parsed: ParsedMission[]; replace: boolean }) => {
      if (replace) {
        const { error } = await supabase.from("missions").delete().eq("pack_id", id);
        if (error) throw error;
      }
      const base = replace ? 0 : (missions.data?.length ?? 0);
      const rows = parsed.map((m, i) => ({
        pack_id: id,
        order_index: base + i,
        title: m.title,
        type: m.type,
        category: m.category,
        question: m.question,
        media_url: m.media_url,
        media_type: m.media_type,
        choices: m.choices,
        answer: m.answer,
        password: m.password,
        hints: m.hints,
        points: m.points,
        time_bonus: m.time_bonus,
        allow_skip: m.allow_skip,
        requires_validation: m.requires_validation,
        explanation: m.explanation,
      }));
      const { error } = await supabase.from("missions").insert(rows as never);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["missions", id] });
      toast.success(`${count} ${t("missions")} ✅`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = missions.data ?? [];

  return (
    <div dir={dir} className="min-h-screen bg-background">
      <header className="border-b-2 border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/teacher" className="font-display text-lg font-extrabold">
            ← {t("back")}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold">{pack.data?.title ?? t("loading")}</h1>
            <p className="text-muted-foreground">{pack.data?.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ImportDialog pending={importMissions.isPending} onImport={(parsed, replace) => importMissions.mutate({ parsed, replace })} />
            <Button
              variant="outline"
              className="rounded-full font-bold"
              onClick={() =>
                pack.data &&
                downloadFile(`${pack.data.title}.md`, toMarkdown(pack.data, list.map(toParsed)), "text/markdown")
              }
            >
              ⬇ {t("exportMarkdown")}
            </Button>
            <Button
              variant="outline"
              className="rounded-full font-bold"
              onClick={() =>
                pack.data &&
                downloadFile(
                  `${pack.data.title}.json`,
                  JSON.stringify({ pack: pack.data, missions: list.map(toParsed) }, null, 2),
                  "application/json",
                )
              }
            >
              ⬇ {t("exportJson")}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">
            {t("missions")} <Badge variant="secondary">{list.length}</Badge>
          </h2>
          <Button
            className="rounded-full font-bold"
            disabled={saveMission.isPending}
            onClick={() =>
              saveMission.mutate({
                title: `${t("mission")} ${list.length + 1}`,
                type: "text",
                order_index: list.length,
                points: 10,
              })
            }
          >
            {saveMission.isPending ? <Loader2 className="animate-spin" /> : null}
            + {t("addMission")}
          </Button>
        </div>

        <Accordion type="single" collapsible className="mt-4 space-y-3">
          {list.map((m) => (
            <AccordionItem key={m.id} value={m.id} className="card-playful border-2 px-4">
              <AccordionTrigger className="font-display text-base font-extrabold hover:no-underline">
                <span className="flex items-center gap-2 text-start">
                  <span aria-hidden="true">{typeMeta(m.type).icon}</span>
                  {m.order_index + 1}. {m.title}
                  <Badge variant="secondary">{m.points} pts</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <MissionForm
                  mission={m}
                  saving={saveMission.isPending}
                  deleting={removeMission.isPending}
                  onSave={(values) => saveMission.mutate({ ...values, id: m.id })}
                  onDelete={() => removeMission.mutate(m.id)}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </div>
  );
}

function MissionForm({
  mission,
  saving,
  deleting,
  onSave,
  onDelete,
}: {
  mission: Mission;
  saving: boolean;
  deleting: boolean;
  onSave: (values: Partial<Mission>) => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => ({
    title: mission.title,
    type: mission.type as MissionType,
    category: mission.category ?? "",
    question: mission.question ?? "",
    media_url: mission.media_url ?? "",
    choices: (mission.choices ?? []).join("\n"),
    answer: Array.isArray(mission.answer) ? (mission.answer as string[]).join("\n") : ((mission.answer as string) ?? ""),
    password: mission.password ?? "",
    hints: (mission.hints ?? []).join("\n"),
    points: mission.points,
    time_bonus: mission.time_bonus,
    allow_skip: mission.allow_skip,
    requires_validation: mission.requires_validation,
    explanation: mission.explanation ?? "",
  }));

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-3 pb-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("title")}</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("type")}</Label>
          <Select value={form.type} onValueChange={(v) => set("type", v as MissionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MISSION_TYPES.map((mt) => (
                <SelectItem key={mt.value} value={mt.value}>
                  {mt.icon} {mt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("question")}</Label>
        <Textarea value={form.question} onChange={(e) => set("question", e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("choices")}</Label>
          <Textarea value={form.choices} onChange={(e) => set("choices", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("answer")}</Label>
          <Textarea value={form.answer} onChange={(e) => set("answer", e.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("hints")}</Label>
          <Textarea value={form.hints} onChange={(e) => set("hints", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("explanation")}</Label>
          <Textarea value={form.explanation} onChange={(e) => set("explanation", e.target.value)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>{t("password")}</Label>
          <Input value={form.password} onChange={(e) => set("password", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("category")}</Label>
          <Input value={form.category} onChange={(e) => set("category", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("points")}</Label>
          <Input type="number" value={form.points} onChange={(e) => set("points", Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Time bonus (s)</Label>
          <Input type="number" value={form.time_bonus} onChange={(e) => set("time_bonus", Number(e.target.value))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("mediaUrl")}</Label>
        <Input value={form.media_url} onChange={(e) => set("media_url", e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border-2 border-border p-3">
          <Label>{t("teacherValidation")}</Label>
          <Switch checked={form.requires_validation} onCheckedChange={(v) => set("requires_validation", v)} />
        </div>
        <div className="flex items-center justify-between rounded-2xl border-2 border-border p-3">
          <Label>{t("allowSkip")}</Label>
          <Switch checked={form.allow_skip} onCheckedChange={(v) => set("allow_skip", v)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          disabled={saving}
          className="rounded-full font-bold"
          onClick={() =>
            onSave({
              title: form.title,
              type: form.type,
              category: form.category,
              question: form.question,
              media_url: form.media_url || null,
              choices: lines(form.choices),
              answer: lines(form.answer).length > 1 ? lines(form.answer) : (lines(form.answer)[0] ?? null),
              password: form.password || null,
              hints: lines(form.hints),
              points: form.points,
              time_bonus: form.time_bonus,
              allow_skip: form.allow_skip,
              requires_validation: form.requires_validation,
              explanation: form.explanation,
            })
          }
        >
          {saving ? <Loader2 className="animate-spin" /> : null}
          {t("save")}
        </Button>
        <Button variant="ghost" className="rounded-full text-destructive" disabled={deleting} onClick={onDelete}>
          {deleting ? <Loader2 className="animate-spin" /> : null}
          {t("delete")}
        </Button>
      </div>
    </div>
  );
}

function ImportDialog({ pending, onImport }: { pending: boolean; onImport: (missions: ParsedMission[], replace: boolean) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);

  function handleImport() {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const json = JSON.parse(trimmed);
        const missions = Array.isArray(json) ? json : json.missions;
        if (!Array.isArray(missions)) throw new Error("No missions array found");
        onImport(missions as ParsedMission[], replace);
      } else {
        const parsed = parseMarkdown(trimmed);
        if (!parsed.missions.length) throw new Error("No missions found in this markdown");
        onImport(parsed.missions, replace);
      }
      setOpen(false);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full font-extrabold shadow-pop">📥 {t("importMarkdown")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("importMarkdown")} / {t("importJson")}</DialogTitle>
          <DialogDescription>{t("pasteMarkdown")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept=".md,.markdown,.txt,.json"
              className="max-w-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setText(await file.text());
              }}
            />
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setText(MARKDOWN_TEMPLATE)}>
              {t("markdownHelp")}
            </Button>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            className="font-mono text-xs"
            placeholder={MARKDOWN_TEMPLATE}
          />
          <div className="flex items-center justify-between rounded-2xl border-2 border-border p-3">
            <Label>{t("replaceExisting")}</Label>
            <Switch checked={replace} onCheckedChange={setReplace} />
          </div>
        </div>
        <DialogFooter>
          <Button className="rounded-full font-bold" disabled={pending} onClick={handleImport}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {t("parseAndImport")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
