/**
 * Repair comparative 보다 → 봅니다 corruption in stored articles.
 * Usage: npx tsx scripts/repair-boda-corruption.ts
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { repairComparativeBodaCorruption } from "../src/lib/editorial/honorific";

function repairDeep(value: unknown): { value: unknown; hits: number } {
  let hits = 0;
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      const next = repairComparativeBodaCorruption(node);
      if (next !== node) hits += 1;
      return next;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        out[key] = walk(child);
      }
      return out;
    }
    return node;
  };
  return { value: walk(value), hits };
}

async function repairJsonFile(rel: string): Promise<{ file: string; hits: number }> {
  const file = path.join(process.cwd(), rel);
  const raw = JSON.parse(await readFile(file, "utf8"));
  const { value, hits } = repairDeep(raw);
  if (hits > 0) {
    const pretty = rel.endsWith("cache.json") ? JSON.stringify(value) : `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(file, pretty, "utf8");
  }
  return { file: rel, hits };
}

async function main() {
  const files = [
    "src/data/briefings/extra.json",
    "src/data/briefings/featured-cards.json",
    "src/data/boards/published.json",
  ];
  const results = [];
  for (const file of files) {
    try {
      results.push(await repairJsonFile(file));
    } catch (error) {
      results.push({ file, hits: -1, error: String(error) });
    }
  }

  // Analysis cache + shards
  try {
    results.push(await repairJsonFile("src/data/analysis/cache.json"));
  } catch {
    /* optional */
  }
  try {
    const dir = path.join(process.cwd(), "src/data/analysis/entries");
    const names = await readdir(dir);
    let shardHits = 0;
    let shardFiles = 0;
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const rel = `src/data/analysis/entries/${name}`;
      const result = await repairJsonFile(rel);
      shardHits += Math.max(0, result.hits);
      if (result.hits > 0) shardFiles += 1;
    }
    results.push({ file: `analysis/entries (${shardFiles} files)`, hits: shardHits });
  } catch {
    /* optional */
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
