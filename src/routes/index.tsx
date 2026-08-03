import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Torazen Playroom | live quiz competitions for schools" },
      {
        name: "description",
        content:
          "Build reusable quiz packs from markdown and run live team competitions for kids aged 7-15, in Arabic, French and English.",
      },
      { property: "og:title", content: "Torazen Playroom" },
      {
        property: "og:description",
        content: "Live team quiz competitions for classrooms, powered by reusable markdown quiz packs.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, dir } = useI18n();
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  return (
    <div dir={dir} className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <span className="font-display text-xl font-extrabold text-primary-foreground drop-shadow">
          {t("appName")}
        </span>
        <LanguageSwitcher />
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 md:grid-cols-2 md:items-center">
        <section className="animate-pop-in text-primary-foreground">
          <h1 className="font-display text-4xl font-extrabold leading-tight drop-shadow-sm sm:text-5xl">
            {t("appName")}
          </h1>
          <p className="mt-4 max-w-md text-lg font-semibold opacity-95">{t("tagline")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary" className="rounded-full text-base font-extrabold shadow-pop">
              <Link to="/auth">🎓 {t("teacherSpace")}</Link>
            </Button>
          </div>
        </section>

        <section className="animate-pop-in card-playful p-6 sm:p-8">
          <h2 className="font-display text-2xl font-extrabold">{t("joinGame")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("enterCode")}</p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim().length >= 4) navigate({ to: "/play/$code", params: { code: code.trim().toUpperCase() } });
            }}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC12"
              maxLength={8}
              aria-label={t("enterCode")}
              className="h-16 rounded-2xl text-center font-display text-3xl font-extrabold tracking-[0.4em]"
            />
            <Button type="submit" size="lg" className="h-14 w-full rounded-2xl text-lg font-extrabold shadow-pop">
              {t("join")} →
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
