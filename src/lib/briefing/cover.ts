import { categoryLabel } from "@/lib/briefing/metrics";
import type { BriefingArticle, BriefingCoverImage, CategoryId } from "@/lib/types";

interface CoverAsset {
  id: string;
  photographer: string;
  queries: string[];
}

const COVERS: Record<CategoryId, CoverAsset[]> = {
  all: [
    { id: "photo-1493225457124-a3eb161ffa5f", photographer: "Austin Neill", queries: ["k-pop", "concert", "stage"] },
    { id: "photo-1514525253161-7a46d19cd819", photographer: "Anthony Delanoix", queries: ["crowd", "festival", "korea"] },
    { id: "photo-1540959733332-eab4deabeeaf", photographer: "jeongneung", queries: ["seoul", "korea", "night"] },
  ],
  kpop: [
    { id: "photo-1470225620780-dba8ba36b745", photographer: "Yvette de Wit", queries: ["k-pop", "concert", "lights"] },
    { id: "photo-1501281668745-f7f57925c3b4", photographer: "Anthony DELANOIX", queries: ["idol", "stage", "crowd"] },
    { id: "photo-1533174072545-7a4b6ad7a6c3", photographer: "Pablo Heimplatz", queries: ["festival", "neon", "performance"] },
  ],
  celebrity: [
    { id: "photo-1492684223066-81342ee5ff30", photographer: "Pablo Heimplatz", queries: ["celebrity", "event", "red-carpet"] },
    { id: "photo-1519741497674-611481863552", photographer: "Alvaro Cv", queries: ["gala", "fashion", "spotlight"] },
    { id: "photo-1464375117522-1311d6a5b81f", photographer: "Anthony DELANOIX", queries: ["portrait", "star", "stage"] },
  ],
  tv_show: [
    { id: "photo-1522869635100-9f4c5e86aa37", photographer: "Glenn Carstens-Peters", queries: ["drama", "television", "living-room"] },
    { id: "photo-1574375927938-d5a98e8ffe85", photographer: "Thibault Penin", queries: ["netflix", "series", "sofa"] },
    { id: "photo-1593784991095-a205069470c9", photographer: "Onur Binay", queries: ["tv", "screen", "broadcast"] },
  ],
  influencer: [
    { id: "photo-1611162616475-46b635cb6868", photographer: "Alexander Shatov", queries: ["creator", "youtube", "influencer"] },
    { id: "photo-1516321318423-f06f85e504b3", photographer: "John Schnobrich", queries: ["vlog", "camera", "studio"] },
    { id: "photo-1554177255-615646fbec1b", photographer: "JESHOOTS.COM", queries: ["smartphone", "social", "content"] },
  ],
  music_chart: [
    { id: "photo-1511671782779-c97d3d27a1d4", photographer: "C D-X", queries: ["music", "headphones", "chart"] },
    { id: "photo-1511379938547-c1f69419868d", photographer: "Benjamin Voros", queries: ["vinyl", "album", "studio"] },
    { id: "photo-1483412036650-ba02d9042cec", photographer: "Austin Ban", queries: ["guitar", "recording", "song"] },
  ],
  tv_rating: [
    { id: "photo-1593784991095-a205069470c9", photographer: "Onur Binay", queries: ["ratings", "television", "prime-time"] },
    { id: "photo-1522869635100-9f4c5e86aa37", photographer: "Glenn Carstens-Peters", queries: ["household", "viewership", "tv"] },
    { id: "photo-1574375927938-d5a98e8ffe85", photographer: "Thibault Penin", queries: ["streaming", "episode", "screen"] },
  ],
  webtoon: [
    { id: "photo-1512820790803-83ca734da794", photographer: "Kimberly Farmer", queries: ["webtoon", "comics", "pages"] },
    { id: "photo-1481627834876-b7833e8f5570", photographer: "Aaron Burden", queries: ["manhwa", "illustration", "book"] },
    { id: "photo-1456513080880-7d93d20d9aa6", photographer: "Thought Catalog", queries: ["reading", "tablet", "story"] },
  ],
  shorts: [
    { id: "photo-1611162616305-c69b3fa7fbe0", photographer: "Alexander Shatov", queries: ["youtube", "shorts", "phone"] },
    { id: "photo-1516251193008-22a60baea959", photographer: "William Iven", queries: ["smartphone", "social", "reels"] },
    { id: "photo-1523205565295-f8e91625443b", photographer: "Neil Son", queries: ["tiktok", "mobile", "video"] },
  ],
  mobile_game: [
    { id: "photo-1556656793-08538906a9f8", photographer: "Tyler Lastovich", queries: ["mobile", "game", "phone"] },
    { id: "photo-1511512578047-dfb367046420", photographer: "JESHOOTS.COM", queries: ["esports", "controller", "mobile"] },
    { id: "photo-1593305841991-05c297ba4575", photographer: "Sean Do", queries: ["gaming", "smartphone", "app"] },
  ],
  pc_game: [
    { id: "photo-1542751371-adc38448a05e", photographer: "Florian Olivo", queries: ["pc", "gaming", "keyboard"] },
    { id: "photo-1493711662062-fa89cadbedc8", photographer: "JESHOOTS.COM", queries: ["steam", "desktop", "play"] },
    { id: "photo-1511512578047-dfb367046420", photographer: "JESHOOTS.COM", queries: ["esports", "monitor", "pc"] },
  ],
  console_game: [
    { id: "photo-1606144042614-b2417e99c4e3", photographer: "Nikita Kachanovsky", queries: ["playstation", "console", "game"] },
    { id: "photo-1612287230202-1ff1d85d1cba", photographer: "Nikita Kachanovsky", queries: ["xbox", "controller", "console"] },
    { id: "photo-1605901309584-818e25960a8f", photographer: "Sean Do", queries: ["nintendo", "switch", "gamepad"] },
  ],
};

function hash(input: string): number {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function unsplashSrc(id: string): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&h=900&q=80`;
}

function keywordFromArticle(
  article: Pick<BriefingArticle, "title" | "relatedEntitySlugs" | "category">,
  keyword?: string,
): string {
  const related = article.relatedEntitySlugs?.[0]?.replaceAll("-", " ");
  const fromTitle = article.title.split(/[:：]/)[0]?.trim();
  return (keyword || related || fromTitle || categoryLabel(article.category)).slice(0, 48);
}

export function briefingCoverFor(
  article: Pick<BriefingArticle, "slug" | "title" | "category" | "kind" | "relatedEntitySlugs" | "coverImage">,
  options?: { keyword?: string; imageUrl?: string },
): BriefingCoverImage {
  const existing = article.coverImage;
  const liveUrl = options?.imageUrl?.trim() || (existing?.source === "live" ? existing.src : "");
  const keyword = keywordFromArticle(article, options?.keyword);

  if (liveUrl && /^https?:\/\//i.test(liveUrl)) {
    return {
      src: liveUrl,
      alt: existing?.alt || `${keyword} 관련 ${categoryLabel(article.category)} 브리핑 이미지`,
      photographer: existing?.photographer,
      source: "live",
    };
  }

  const pool = COVERS[article.category] ?? COVERS.all;
  const asset = pool[hash(`${article.slug}:${keyword}`) % pool.length] ?? pool[0] ?? COVERS.all[0];
  return {
    src: unsplashSrc(asset.id),
    alt: `${keyword} · ${asset.queries[0] ?? categoryLabel(article.category)} 트렌드 브리핑`,
    photographer: asset.photographer,
    source: "unsplash",
  };
}

export function withBriefingCover(
  article: BriefingArticle,
  options?: { keyword?: string; imageUrl?: string },
): BriefingArticle {
  if (article.coverImage?.src && !options?.imageUrl) return article;
  return { ...article, coverImage: briefingCoverFor(article, options) };
}
