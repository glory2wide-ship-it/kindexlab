"use client";

import { useEffect } from "react";
import { INDEX_WEIGHTS, METHODOLOGY } from "@/data/methodology";

export function MethodologyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="methodology-title"
        className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-2xl md:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Methodology</p>
        <h2 id="methodology-title" className="mt-2 text-2xl font-semibold">
          {METHODOLOGY.title}
        </h2>
        <p className="mt-2 text-sm text-muted">{METHODOLOGY.subtitle}</p>
        <p className="mt-4 rounded-lg bg-board px-3 py-2 font-mono text-xs leading-5">
          {METHODOLOGY.formula}
        </p>
        <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
          {INDEX_WEIGHTS.map((item) => (
            <li key={item.key} className="flex gap-4 px-4 py-3 text-sm">
              <span className="w-10 font-mono text-accent">{item.weight}%</span>
              <span>
                <span className="font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{item.sources}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-3 text-sm leading-7 text-ink/90">
          {METHODOLOGY.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-black"
        >
          지수(INDEX)로 돌아가기
        </button>
      </div>
    </div>
  );
}
