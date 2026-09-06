import { CATEGORIES } from "@/lib/categories";
import type { CategoryId } from "@/lib/types";

export function ArchiveSearchForm({
  query = "",
  category,
}: {
  query?: string;
  category?: CategoryId;
}) {
  return (
    <form action="/briefing/archive" method="get" className="flex flex-col gap-3 md:flex-row">
      <label className="sr-only" htmlFor="archive-q">
        브리핑 검색
      </label>
      <input
        id="archive-q"
        name="q"
        type="search"
        defaultValue={query}
        placeholder="종목, 이슈, 날짜로 검색"
        className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-board px-3 text-sm outline-none ring-accent/40 focus:ring-2"
      />
      <label className="sr-only" htmlFor="archive-category">
        카테고리
      </label>
      <select
        id="archive-category"
        name="category"
        defaultValue={category ?? "all"}
        className="h-10 rounded-lg border border-line bg-board px-3 text-sm"
      >
        {CATEGORIES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-10 rounded-lg bg-accent px-4 text-sm font-medium text-black"
      >
        검색
      </button>
    </form>
  );
}
