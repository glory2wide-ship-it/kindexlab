import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BriefingArticle } from "@/lib/types";

const extraRel = path.join("src", "data", "briefings", "extra.json");

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
