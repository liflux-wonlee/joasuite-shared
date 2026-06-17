import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "../i18n-helper";

interface Props {
  className?: string;
  variant?: "sidebar" | "default";
}

export function LanguageSwitcher({ className, variant = "default" }: Props) {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];

  const cls = [
    "flex items-center gap-1.5 text-xs",
    className ?? "",
  ].join(" ");

  const selectCls = [
    "rounded px-1.5 py-1 border outline-none cursor-pointer",
    variant === "sidebar"
      ? "bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border"
      : "bg-background text-foreground border-input",
  ].join(" ");

  return (
    <label className={cls}>
      <Globe className="h-3.5 w-3.5 opacity-70" />
      <select
        aria-label="Language"
        value={current}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className={selectCls}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
