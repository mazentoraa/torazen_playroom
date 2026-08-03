import { LANGUAGES, useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full border-2 border-border bg-card p-1", className)}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code as Lang)}
          aria-pressed={lang === l.code}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-bold transition-colors",
            lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          <span aria-hidden="true">{l.flag}</span> <span className="hidden sm:inline">{l.label}</span>
        </button>
      ))}
    </div>
  );
}
