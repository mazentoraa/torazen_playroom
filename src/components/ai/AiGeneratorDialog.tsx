import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles, Check } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { usePendingAction } from "@/hooks/usePendingAction";
import { generatePack } from "@/lib/ai-functions";
import type { ParsedPack, ParsedMission } from "@/lib/markdown";
import { typeMeta } from "@/lib/missions";
import type { QuizPack } from "@/lib/db";

function toInsertRows(packId: string, missions: ParsedMission[], base: number) {
  return missions.map((m, i) => ({
    pack_id: packId,
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
}

function PreviewMissionContent({ mission }: { mission: ParsedMission }) {
  const { t } = useI18n();
  const answers = Array.isArray(mission.answer)
    ? mission.answer.map(String)
    : mission.answer
      ? [String(mission.answer)]
      : [];
  const correct = (c: string) =>
    answers.some((a) => a.trim().toLowerCase() === c.trim().toLowerCase());

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{mission.type}</Badge>
        {mission.category ? <Badge variant="outline">{mission.category}</Badge> : null}
        {mission.requires_validation ? <Badge>{t("teacherValidation")}</Badge> : null}
      </div>
      {mission.question ? <p className="font-semibold">{mission.question}</p> : null}
      {mission.choices?.length ? (
        <ul className="space-y-1">
          {mission.choices.map((c, i) => (
            <li
              key={i}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${correct(c) ? "border-primary bg-primary/5 font-bold" : "border-border"}`}
            >
              {correct(c) ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : (
                <span className="shrink-0">•</span>
              )}
              {c}
            </li>
          ))}
        </ul>
      ) : null}
      {answers.length ? (
        <p>
          <span className="font-bold">{t("answer")}:</span> {answers.join(", ")}
        </p>
      ) : null}
      {mission.password ? (
        <p>
          <span className="font-bold">{t("password")}:</span> {mission.password}
        </p>
      ) : null}
      {mission.hints?.length ? (
        <p>
          <span className="font-bold">{t("hints")}:</span> {mission.hints.join(" • ")}
        </p>
      ) : null}
      {mission.explanation ? <p className="text-muted-foreground">{mission.explanation}</p> : null}
    </div>
  );
}

export function AiGeneratorDialog({
  mode,
  packId,
  existingCount = 0,
}: {
  mode: "new-pack" | "append";
  packId?: string;
  existingCount?: number;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { run, isPending } = usePendingAction();

  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(10);
  const [language, setLanguage] = useState<"en" | "fr" | "ar">(lang);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [allowManual, setAllowManual] = useState(false);
  const [result, setResult] = useState<ParsedPack | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const previewMissions = result?.missions ?? [];

  const reset = () => {
    setPrompt("");
    setCount(10);
    setDifficulty("medium");
    setAllowManual(false);
    setResult(null);
    setTitle("");
    setDescription("");
  };

  const handleGenerate = () => {
    void run("generate", async () => {
      setResult(null);
      try {
        const pack = await generatePack({
          data: { prompt, count, language, difficulty, allowManual },
        });
        setResult(pack);
        setTitle(pack.title);
        setDescription(pack.description);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("aiError"));
      }
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!result || !previewMissions.length) throw new Error(t("aiNoMissions"));
      if (!user) throw new Error(t("signIn"));

      if (mode === "append") {
        if (!packId) throw new Error(t("aiError"));
        const { error } = await supabase
          .from("missions")
          .insert(toInsertRows(packId, previewMissions, existingCount) as never);
        if (error) throw error;
        return null;
      }

      const { data, error } = await supabase
        .from("quiz_packs")
        .insert({ title, description: description || null, language, owner_id: user.id })
        .select()
        .single();
      if (error) throw error;
      const pack = data as QuizPack;
      const { error: missionError } = await supabase
        .from("missions")
        .insert(toInsertRows(pack.id, previewMissions, 0) as never);
      if (missionError) throw missionError;
      return pack;
    },
    onSuccess: (pack) => {
      if (mode === "append") {
        qc.invalidateQueries({ queryKey: ["missions", packId] });
        toast.success(`${previewMissions.length} ${t("missions")} ✅`);
      } else {
        qc.invalidateQueries({ queryKey: ["packs"] });
        setOpen(false);
        navigate({ to: "/packs/$id", params: { id: pack!.id } });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = isPending("generate") || save.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-full font-extrabold shadow-pop">
          <Sparkles className="h-4 w-4" />
          {mode === "append" ? t("aiAddMissions") : t("aiGenerate")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Sparkles className="mr-1 inline h-5 w-5" />
            {mode === "append" ? t("aiAddMissions") : t("aiGenerate")}
          </DialogTitle>
          <DialogDescription>{t("aiPromptHint")}</DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("aiPrompt")}</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder={t("aiPromptPlaceholder")}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t("aiCount")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("language")}</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as "en" | "fr" | "ar")}
                >
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
              <div className="space-y-1.5">
                <Label>{t("aiDifficulty")}</Label>
                <Select
                  value={difficulty}
                  onValueChange={(v) => setDifficulty(v as "easy" | "medium" | "hard")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{t("aiEasy")}</SelectItem>
                    <SelectItem value="medium">{t("aiMedium")}</SelectItem>
                    <SelectItem value="hard">{t("aiHard")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border-2 border-border p-3">
              <Label>{t("aiAllowManual")}</Label>
              <Switch checked={allowManual} onCheckedChange={setAllowManual} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("title")}</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("description")}</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <p className="font-bold">
              {t("aiPreview")}{" "}
              <Badge variant="secondary">
                {previewMissions.length} {t("missions")}
              </Badge>
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              <Accordion type="single" collapsible className="space-y-2">
                {previewMissions.map((m, i) => (
                  <AccordionItem
                    key={i}
                    value={String(i)}
                    className="rounded-2xl border-2 border-border px-3"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <span className="flex w-full items-center gap-2 text-start">
                        <span aria-hidden="true">{typeMeta(m.type).icon}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {i + 1}. {m.title}
                        </span>
                        <Badge variant="secondary">{m.points} pts</Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <PreviewMissionContent mission={m} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full font-bold"
              disabled={pending}
              onClick={() => setResult(null)}
            >
              {t("aiBack")}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            className="rounded-full font-bold"
            disabled={!prompt.trim() || pending}
            onClick={() => {
              if (result) save.mutate();
              else handleGenerate();
            }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {result ? t("aiCreatePack") : pending ? t("isGenerating") : t("aiGenerateNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
