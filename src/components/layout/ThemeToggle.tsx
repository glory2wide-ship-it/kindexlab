"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";

/** Previous sizes × 0.85 (15% smaller). */
const ICON_GAP_PX = 10.282;
const TRACK_WIDTH_PX = 64.6;
const TRACK_HEIGHT_PX = 28.9;
const THUMB_SIZE_PX = 23.8;
const THUMB_TRAVEL_PX = TRACK_WIDTH_PX - 30.6;
const SUN_SIZE_PX = 12.75;
const MOON_SIZE_PX = 11.9;

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
      className="relative flex origin-center scale-[0.85] shrink-0 items-center justify-center rounded-full bg-[#e2e8f0] p-0.5 shadow-inner dark:bg-[#334155] md:scale-100"
      style={{ width: TRACK_WIDTH_PX, height: TRACK_HEIGHT_PX }}
      role="group"
      aria-label="테마 전환"
      suppressHydrationWarning
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 flex items-center justify-center rounded-full transition-all duration-300 ease-in-out ${
          isDark ? DARK_THUMB : LIGHT_THUMB
        }`}
        style={{
          width: THUMB_SIZE_PX,
          height: THUMB_SIZE_PX,
          transform: isDark ? `translateX(${THUMB_TRAVEL_PX}px)` : "translateX(0)",
        }}
      />
      <div className="relative z-10 flex items-center justify-center" style={{ gap: ICON_GAP_PX }}>
        <button
          type="button"
          disabled={!mounted}
          onClick={() => setTheme("light")}
          className="flex cursor-pointer items-center justify-center rounded-full"
          style={{ width: THUMB_SIZE_PX, height: THUMB_SIZE_PX }}
          aria-label="라이트 모드"
          aria-pressed={!isDark}
        >
          <Sun
            className="stroke-[2.25]"
            style={{ color: SUN_SKY, width: SUN_SIZE_PX, height: SUN_SIZE_PX }}
            aria-hidden
          />
        </button>
        <button
          type="button"
          disabled={!mounted}
          onClick={() => setTheme("dark")}
          className="flex cursor-pointer items-center justify-center rounded-full"
          style={{ width: THUMB_SIZE_PX, height: THUMB_SIZE_PX }}
          aria-label="다크 모드"
          aria-pressed={isDark}
        >
          <Moon
            className="stroke-[2.25]"
            style={{ color: MOON_GOLD, width: MOON_SIZE_PX, height: MOON_SIZE_PX }}
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}
