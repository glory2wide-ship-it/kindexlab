"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const VISITOR_KEY = "kindex_vid";
const HEARTBEAT_MS = 10 * 60 * 1000;

function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `v_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return `anon_${Date.now().toString(36)}`;
  }
}

function sendBeacon(payload: {
  visitorId: string;
  path: string;
  title: string;
  pageview: boolean;
}) {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/analytics/beacon", blob)) return;
    }
  } catch {
    /* fall through */
  }
  void fetch("/api/analytics/beacon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/** Anonymous first-party traffic beacon for /admin ops. */
export function TrafficBeacon() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    const visitorId = getVisitorId();
    const isNewPath = lastPath.current !== pathname;
    lastPath.current = pathname;

    sendBeacon({
      visitorId,
      path: pathname,
      title: typeof document !== "undefined" ? document.title : "",
      pageview: isNewPath,
    });

    const timer = window.setInterval(() => {
      sendBeacon({
        visitorId,
        path: pathname,
        title: typeof document !== "undefined" ? document.title : "",
        pageview: false,
      });
    }, HEARTBEAT_MS);

    return () => window.clearInterval(timer);
  }, [pathname]);

  return null;
}
