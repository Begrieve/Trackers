"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "dark", label: "Dark", icon: "☾" },
  { value: "system", label: "Auto", icon: "◐" },
];

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme !== "system") root.classList.add(theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Private browsing can block storage; the theme still applies for this visit.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
      stored = null;
    }
    if (stored === "light" || stored === "dark" || stored === "system") setTheme(stored);
    setReady(true);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex rounded-lg border border-line p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = ready && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={active}
            title={`${option.label} theme`}
            className={`rounded-md px-2 py-1 text-sm transition ${
              active ? "bg-surface-2 text-fg" : "text-fg-subtle hover:text-fg"
            }`}
          >
            <span aria-hidden>{option.icon}</span>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
