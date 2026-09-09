/**
 * Copies non-template board rankings into the committed published.json file.
 *
 *   npx tsx --env-file=.env.local scripts/publish-boards.ts
 *   npx tsx --env-file=.env.local scripts/publish-boards.ts --kind=chain
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { listBoards } from "../src/lib/boards/store";
import type { CachedBoard } from "../src/lib/boards/types";

function arg(name: string): string | undefined {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`));
  return found?.split("=")[1];
}

async function main() {
  const kind = arg("kind") ?? "chain";
  const boards = await listBoards();
  const selected = boards
    .filter((entry) => (kind === "all" ? true : entry.provenance?.kind === kind))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const file = path.join(process.cwd(), "src", "data", "boards", "published.json");
  await mkdir(path.dirname(file), { recursive: true });

  let existing: CachedBoard[] = [];
  try {
    const raw = await readFile(file, "utf8");
    existing = (JSON.parse(raw) as { entries?: CachedBoard[] }).entries ?? [];
  } catch {
    existing = [];
  }

  const bySlug = new Map(existing.map((entry) => [entry.slug, entry]));
  for (const entry of selected) bySlug.set(entry.slug, entry);
  const entries = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));

  await writeFile(file, `${JSON.stringify({ entries }, null, 2)}\n`, "utf8");
  console.log(`published ${selected.length} (${kind}) · total file ${entries.length} → ${file}`);
}

void main();
