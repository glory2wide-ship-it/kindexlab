"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { POST_CHANNELS } from "@/lib/posts/channels";

/**
 * Mobile-only site menu (md+ unused).
 * Holds channel links so the header stays one row.
 * Theme toggle lives in the mobile header next to LIVE / countdown.
 */
export function MobileMenuSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] md:hidden" role="dialog" aria-modal="true" aria-label="메뉴">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="메뉴 닫기"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col border-l border-line bg-panel shadow-xl">
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <p className="text-sm font-semibold">메뉴</p>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-md text-muted hover:bg-board hover:text-ink"
            aria-label="닫기"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="카테고리">
          <p className="px-2 pb-2 text-[11px] font-semibold tracking-wide text-soft">카테고리</p>
          <ul className="flex flex-col gap-1">
            {POST_CHANNELS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    onClick={onClose}
                    className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                      active ? "bg-accent text-black" : "text-ink hover:bg-board"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export function MobileMenuButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-panel text-ink md:hidden"
      aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
      aria-expanded={open}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {open ? (
          <path d="M6 6l12 12M18 6L6 18" />
        ) : (
          <>
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </>
        )}
      </svg>
    </button>
  );
}
