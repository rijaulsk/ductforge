"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useHasMounted } from "@/lib/hooks";

const KEY = "ductforge.theme.v1";

/* Light and dark are both first-class here.
 *
 * The marketing site is cream and stays cream. This is a workspace someone has
 * open all day, and the design system's §1 already carries a dark palette for
 * exactly that case. Until the user chooses, the page follows the operating
 * system; once they choose, the choice sticks and wins over it.
 */
function currentTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "dark" || set === "light") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  const mounted = useHasMounted();
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  /* Adjusted during render, not in an effect. The answer is already on the DOM
   * — the pre-paint script put it there — so there is nothing to wait for, and
   * an effect would render one frame with the wrong icon. */
  if (mounted && theme === null) setTheme(currentTheme());
  const shown = theme ?? "light";

  const flip = () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* Blocked storage: the choice holds for this session only. */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={flip}
      /* Invisible until hydrated, but it still occupies its space, so nothing
       * on the bar jumps sideways when it appears. */
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-line text-heading transition duration-200 ease-out hover:bg-sunk ${
        mounted ? "" : "invisible"
      }`}
      aria-label={shown === "dark" ? "Switch to the light theme" : "Switch to the dark theme"}
      title={shown === "dark" ? "Light theme" : "Dark theme"}
    >
      {shown === "dark" ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
    </button>
  );
}
