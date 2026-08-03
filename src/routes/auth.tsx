import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Teacher sign in | Torazen Playroom" },
      { name: "description", content: "Sign in to create quiz packs and run live classroom competitions." },
      { property: "og:title", content: "Teacher sign in | Torazen Playroom" },
      { property: "og:description", content: "Create quiz packs and run live classroom competitions." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/teacher" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name }, emailRedirectTo: `${window.location.origin}/teacher` },
        });
        if (error) throw error;
        toast.success("Account created. We sent a confirmation email.");
        setMode("in");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/teacher" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-hero">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <Link to="/" className="font-display text-lg font-extrabold text-primary-foreground">
          ← {t("appName")}
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="card-playful w-full max-w-md animate-pop-in p-7">
          <h1 className="font-display text-3xl font-extrabold">{t("teacherSpace")}</h1>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "up" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("displayName")}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl text-base font-extrabold">
              {busy ? <Loader2 className="animate-spin" /> : null}
              {mode === "in" ? t("signIn") : t("signUp")}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 w-full text-sm font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? t("signUp") : t("signIn")}
          </button>
        </div>
      </main>
    </div>
  );
}
