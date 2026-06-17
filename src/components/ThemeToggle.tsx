import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useJoaSuite } from "../context";

export function ThemeToggle() {
  const { ui, themeStorageKey = "joasuite-theme" } = useJoaSuite();
  const { Button } = ui;
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const saved = localStorage.getItem(themeStorageKey);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved ? saved === "dark" : prefersDark;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    setIsDark(dark);
  }, [themeStorageKey]);

  const toggle = () => {
    const root = document.documentElement;
    const next = !isDark;
    if (next) {
      root.classList.add("dark");
      localStorage.setItem(themeStorageKey, "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem(themeStorageKey, "light");
    }
    setIsDark(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
      className="shrink-0"
    >
      {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  );
}
