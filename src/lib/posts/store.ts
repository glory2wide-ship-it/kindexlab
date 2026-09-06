import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import generatedFile from "@/data/posts/generated.json";
import { inferPostChannel } from "@/lib/posts/channels";
import type { GeneratedPost, PostChannel, PostFaq, PostLink, PostTable } from "@/lib/posts/types";
import { decodeRouteSlug, slugsMatch } from "@/lib/slugs";

const EMPTY_TABLE: PostTable = { caption: "", headers: [], rows: [] };
const EMPTY_LINK: PostLink = { href: "/#heatmap", label: "실시간 지수(INDEX)" };

function tableMarkdown(table: Pick<PostTable, "headers" | "rows">): string {
  if (!table.headers.length) return "";
  const head = `| ${table.headers.join(" | ")} |`;
  const sep = `| ${table.headers.map(() => "---").join(" | ")} |`;
  const body = table.rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

function normalizePost(post: GeneratedPost): GeneratedPost {
  const table = post.table?.headers?.length
    ? { ...post.table, markdown: post.table.markdown || tableMarkdown(post.table) }
    : EMPTY_TABLE;
  const faq: PostFaq[] = Array.isArray(post.faq) ? post.faq : [];
  return {
    ...post,
    wordCount: post.wordCount ?? 0,
    characterCount: post.characterCount ?? 0,
    focusKeyword: post.focusKeyword ?? "",
    supportKeyword: post.supportKeyword ?? "",
    channel: inferPostChannel(post),
    table,
    faq,
    externalLink: post.externalLink ?? {
      href: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
      label: "ECB 유로 참고환율",
      rel: "noopener noreferrer",
    },
    internalLink: post.internalLink ?? EMPTY_LINK,
  };
}

const fileRel = path.join("src", "data", "posts", "generated.json");
const memory = new Map<string, GeneratedPost>();
let fileWriteQueue = Promise.resolve();

function queueFileWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = fileWriteQueue.then(task, task);
  fileWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function bundled(): GeneratedPost[] {
  const articles = (generatedFile as { articles?: GeneratedPost[] }).articles;
  return Array.isArray(articles) ? articles.map(normalizePost) : [];
}

async function readDisk(): Promise<GeneratedPost[]> {
  try {
    const raw = await readFile(path.join(process.cwd(), fileRel), "utf8");
    const parsed = JSON.parse(raw) as { articles?: GeneratedPost[] };
    return (parsed.articles ?? []).map(normalizePost);
  } catch {
    return bundled();
  }
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function supabaseUpsert(post: GeneratedPost): Promise<boolean> {
  const config = supabaseConfig();
  if (!config) return false;
  try {
    const response = await fetch(`${config.url}/rest/v1/posts`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        published_at: post.publishedAt,
        slot: post.slot,
        edition_date: post.editionDate,
        character_count: post.characterCount,
        word_count: post.wordCount,
        body: post,
      }),
    });
    return response.ok || response.status === 409;
  } catch {
    return false;
  }
}

async function supabaseList(): Promise<GeneratedPost[]> {
  const config = supabaseConfig();
  if (!config) return [];
  try {
    const response = await fetch(
      `${config.url}/rest/v1/posts?select=body&order=published_at.desc&limit=50`,
      {
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        cache: "no-store",
      },
    );
    if (!response.ok) return [];
    const rows = (await response.json()) as { body?: GeneratedPost }[];
    return rows
      .map((row) => row.body)
      .filter((item): item is GeneratedPost => Boolean(item?.slug))
      .map(normalizePost);
  } catch {
    return [];
  }
}

/** Hard stop for 이슈칼럼 writes after the product surface was retired. */
const ISSUE_COLUMNS_RETIRED = true;

export async function replaceGeneratedArticles(
  posts: GeneratedPost[],
): Promise<{ file: boolean; supabase: boolean }> {
  if (ISSUE_COLUMNS_RETIRED && posts.length > 0) {
    throw new Error("이슈칼럼(premium columns) generation is retired; refusing to write articles.");
  }
  memory.clear();
  const normalized = posts.map(normalizePost);
  for (const post of normalized) memory.set(post.slug, post);
  let supabase = false;
  for (const post of normalized) {
    if (await supabaseUpsert(post)) supabase = true;
  }
  if (process.env.VERCEL === "1") return { file: false, supabase };
  return queueFileWrite(async () => {
    try {
      const file = path.join(process.cwd(), fileRel);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, `${JSON.stringify({ articles: normalized }, null, 2)}\n`, "utf8");
      return { file: true, supabase };
    } catch {
      return { file: false, supabase };
    }
  });
}

export async function persistGeneratedPost(post: GeneratedPost): Promise<{ file: boolean; supabase: boolean }> {
  if (ISSUE_COLUMNS_RETIRED) {
    throw new Error("이슈칼럼(premium columns) generation is retired; refusing to persist articles.");
  }
  const normalized = normalizePost(post);
  memory.set(normalized.slug, normalized);
  const supabase = await supabaseUpsert(normalized);
  if (process.env.VERCEL === "1") return { file: false, supabase };
  return queueFileWrite(async () => {
    try {
      const existing = await readDisk();
      const merged = [normalized, ...existing.filter((item) => item.slug !== normalized.slug)];
      const file = path.join(process.cwd(), fileRel);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, `${JSON.stringify({ articles: merged }, null, 2)}\n`, "utf8");
      return { file: true, supabase };
    } catch {
      return { file: false, supabase };
    }
  });
}

export async function listPosts(): Promise<GeneratedPost[]> {
  const [disk, remote] = await Promise.all([readDisk(), supabaseList()]);
  const bySlug = new Map<string, GeneratedPost>();
  for (const item of [...remote, ...disk, ...memory.values()]) {
    const prev = bySlug.get(item.slug);
    const nextStamp = item.updatedAt || item.publishedAt || "";
    const prevStamp = prev?.updatedAt || prev?.publishedAt || "";
    if (!prev || nextStamp >= prevStamp) bySlug.set(item.slug, item);
  }
  return [...bySlug.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function listPostsByChannel(channel: PostChannel): Promise<GeneratedPost[]> {
  const posts = await listPosts();
  return posts.filter((item) => inferPostChannel(item) === channel);
}

export async function getPostBySlug(slug: string): Promise<GeneratedPost | undefined> {
  const decoded = decodeRouteSlug(slug);
  if (memory.has(decoded)) return memory.get(decoded);
  const posts = await listPosts();
  return posts.find((item) => slugsMatch(item.slug, decoded) || slugsMatch(item.slug, slug));
}

export function listSeededSlugs(): string[] {
  return bundled().map((item) => item.slug);
}
