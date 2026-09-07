#!/usr/bin/env node
/**
 * Writes one JSON file per today's-analysis slug so ranking pages do not
 * JSON.parse the 5–6 MB monolith on every cold start.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CACHE = path.join(ROOT, "src", "data", "analysis", "cache.json");
const DIR = path.join(ROOT, "src", "data", "analysis", "entries");
const STAMP = path.join(DIR, ".stamp");

function shardName(slug) {
  return `${createHash("sha1").update(slug).digest("hex").slice(0, 20)}.json`;
}

async function main() {
  let cacheStat;
  try {
    cacheStat = await stat(CACHE);
  } catch {
    console.log("split-analysis-cache: no cache.json, skip");
    return;
  }
  try {
    const stamp = await stat(STAMP);
    if (stamp.mtimeMs >= cacheStat.mtimeMs) {
      console.log("split-analysis-cache: shards up to date");
      return;
    }
  } catch {
    /* write shards */
  }

  const parsed = JSON.parse(await readFile(CACHE, "utf8"));
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  await mkdir(DIR, { recursive: true });
  await Promise.all(
    entries
      .filter((entry) => entry?.slug)
      .map((entry) =>
        writeFile(path.join(DIR, shardName(entry.slug)), `${JSON.stringify(entry)}\n`),
      ),
  );
  await writeFile(STAMP, `${entries.length}\n${cacheStat.mtimeMs}\n`);
  console.log(`split-analysis-cache: ${entries.length} shards`);
}

await main();
