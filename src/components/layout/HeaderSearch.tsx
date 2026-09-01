"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SEARCH_BUTTON_CLASS,
  SEARCH_FORM_CLASS,
  SEARCH_INPUT_CLASS,
  SEARCH_INPUT_STYLE,
} from "@/components/layout/header-search-ui";
import type { SearchSuggestion } from "@/lib/search/suggest";

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

export function HeaderSearch() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 256 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function updateMenuPos() {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 256),
    });
  }

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: SearchSuggestion[] };
        const next = (data.suggestions ?? []).slice(0, 5);
        setSuggestions(next);
        setActive(0);
        setOpen(next.length > 0);
        if (next.length) updateMenuPos();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }, 40);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    updateMenuPos();
    window.addEventListener("resize", updateMenuPos);
    window.addEventListener("scroll", updateMenuPos, true);
    return () => {
      window.removeEventListener("resize", updateMenuPos);
      window.removeEventListener("scroll", updateMenuPos, true);
    };
  }, [open, suggestions.length]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function submitSearch() {
    const q = query.trim();
    const pick = suggestions[active];
    if (open && pick) {
      go(pick.href);
      return;
    }
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  const dropdown =
    mounted && open && suggestions.length
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            className="fixed z-[400] overflow-hidden rounded-xl border border-black/10 bg-[#e8eaed] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-[#3c4043]"
          >
            {suggestions.map((item, index) => (
              <li key={`${item.href}-${item.label}`} role="presentation">
                <button
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => go(item.href)}
                  className={`block w-full truncate px-3 py-2 text-left text-[13px] ${
                    index === active
                      ? "bg-white/80 text-[#202124] dark:bg-white/10 dark:text-white"
                      : "text-[#5f6368] dark:text-[#bdc1c6]"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <form
      ref={rootRef}
      action="/search"
      className={SEARCH_FORM_CLASS}
      onSubmit={(event) => {
        event.preventDefault();
        submitSearch();
      }}
    >
      <label htmlFor="site-search" className="sr-only">
        종목·키워드 검색
      </label>
      <input
        ref={inputRef}
        id="site-search"
        type="text"
        name="q"
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && suggestions[active] ? `${listId}-${active}` : undefined}
        onChange={(event) => setQuery(event.target.value)}
        onCompositionEnd={(event) => setQuery(event.currentTarget.value)}
        onFocus={() => {
          if (suggestions.length) {
            updateMenuPos();
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (!suggestions.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => (index - 1 + suggestions.length) % suggestions.length);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        placeholder="종목·키워드 검색"
        className={SEARCH_INPUT_CLASS}
        style={SEARCH_INPUT_STYLE}
      />
      <button
        type="submit"
        aria-label="검색"
        className={SEARCH_BUTTON_CLASS}
      >
        <SearchIcon className="h-4 w-4" />
      </button>
      {dropdown}
    </form>
  );
}
