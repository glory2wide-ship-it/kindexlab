"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";

/** Previous gap 15.12px × 0.8 */
const ICON_GAP_PX = 12.096;
const TRACK_WIDTH_PX = 76;
const THUMB_TRAVEL_PX = TRACK_WIDTH_PX - 36;

const LIGHT_THUMB =
  "bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 shadow-md";
const DARK_THUMB =
  "bg-gradient-to-br from-indigo-500 via-blue-600 to-slate-800 shadow-md";
const SUN_SKY = "#38bdf8";
const MOON_GOLD = "#fbbf24";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div
      className="relative flex h-[34px] shrink-0 items-center justify-center rounded-full bg-[#e2e8f0] p-1 shadow-inner dark:bg-[#334155]"
      style={{ width: TRACK_WIDTH_PX }}
      role="group"
      aria-label="테마 전환"
      suppressHydrationWarning
    >
      <span
        aria-hidden
        className={`absolute top-1 left-1 flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ease-in-out ${
          isDark ? DARK_THUMB : LIGHT_THUMB
        }`}
        style={{ transform: isDark ? `translateX(${THUMB_TRAVEL_PX}px)` : "translateX(0)" }}
      />
      <div className="relative z-10 flex items-center justify-center" style={{ gap: ICON_GAP_PX }}>
        <button
          type="button"
          disabled={!mounted}
          onClick={() => setTheme("light")}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full"
          aria-label="라이트 모드"
          aria-pressed={!isDark}
        >
          <Sun
            className="h-[15px] w-[15px] stroke-[2.25]"
            style={{ color: SUN_SKY }}
            aria-hidden
          />
        </button>
        <button
          type="button"
          disabled={!mounted}
          onClick={() => setTheme("dark")}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full"
          aria-label="다크 모드"
          aria-pressed={isDark}
        >
          <Moon
            className="h-[14px] w-[14px] stroke-[2.25]"
            style={{ color: MOON_GOLD }}
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}
