"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeName = "light" | "dark";

const ThemeContext = createContext<{
  resolvedTheme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}>({
  resolvedTheme: "dark",
  setTheme: () => undefined,
});

function applyTheme(theme: ThemeName) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const next: ThemeName =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setThemeState(next);
    applyTheme(next);
  }, []);

  const value = useMemo(
    () => ({
      resolvedTheme: theme,
      setTheme: (next: ThemeName) => {
        setThemeState(next);
        window.localStorage.setItem("theme", next);
        applyTheme(next);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
