import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BriefingArticle } from "@/lib/types";

const extraRel = path.join("src", "data", "briefings", "extra.json");

/**
 * Empties the persisted edition file. `published.ts` seeds stay compiled into
 * the bundle, so the purge reports how many stored editions it dropped rather
 * than claiming the archive is empty.
 */
export async function clearPersistedEditions(): Promise<number> {
  const file = path.join(process.cwd(), extraRel);
  try {
    let removed = 0;
    try {
      const raw = await readFile(file, "utf8");
      removed = ((JSON.parse(raw) as { articles?: BriefingArticle[] }).articles ?? []).length;
    } catch {
      removed = 0;
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify({ articles: [] }, null, 2)}\n`, "utf8");
    return removed;
  } catch {
    return 0;
  }
}

export async function removePersistedEdition(editionDate: string): Promise<number> {
  const file = path.join(process.cwd(), extraRel);
  try {
    let existing: BriefingArticle[] = [];
    try {
      const raw = await readFile(file, "utf8");
      existing = (JSON.parse(raw) as { articles?: BriefingArticle[] }).articles ?? [];
    } catch {
      return 0;
    }
    const kept = existing.filter((item) => item.editionDate !== editionDate);
    const removed = existing.length - kept.length;
    if (removed === 0) return 0;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify({ articles: kept }, null, 2)}\n`, "utf8");
    return removed;
  } catch {
    return 0;
  }
}

export async function persistEdition(articles: BriefingArticle[]): Promise<{ wrote: boolean; path: string }> {
  const file = path.join(process.cwd(), extraRel);
  try {
    await mkdir(path.dirname(file), { recursive: true });
    let existing: BriefingArticle[] = [];
    try {
      const raw = await readFile(file, "utf8");
      existing = (JSON.parse(raw) as { articles?: BriefingArticle[] }).articles ?? [];
    } catch {
      existing = [];
    }
    const slugs = new Set(articles.map((item) => item.slug));
    const merged = [...existing.filter((item) => !slugs.has(item.slug)), ...articles].sort((a, b) =>
      `${b.editionDate}${b.slug}`.localeCompare(`${a.editionDate}${a.slug}`),
    );
    await writeFile(file, `${JSON.stringify({ articles: merged }, null, 2)}\n`, "utf8");
    return { wrote: true, path: extraRel };
  } catch {
    return { wrote: false, path: extraRel };
  }
}
