import type { RankingEntity } from "@/lib/types";

/** Display tags shown in front of 게임 e스포츠 names. */
export type GamePlatformTag =
  | "PC"
  | "모바일"
  | "콘솔"
  | "PC/콘솔"
  | "모바일/PC"
  | "모바일/콘솔"
  | "모바일/PC/콘솔";

const GAME_PLATFORM_BY_NAME: Record<string, GamePlatformTag> = {
  리그오브레전드: "PC",
  lol: "PC",
  롤: "PC",
  발로란트: "PC",
  valorant: "PC",
  배틀그라운드: "PC/콘솔",
  배그: "PC/콘솔",
  pubg: "PC/콘솔",
  fc온라인: "PC",
  피파온라인: "PC",
  메이플스토리: "PC",
  오버워치2: "PC/콘솔",
  오버워치: "PC/콘솔",
  로블록스: "모바일/PC/콘솔",
  마인크래프트: "모바일/PC/콘솔",
  원신: "모바일/PC/콘솔",
  젠지: "PC",
  t1: "PC",
  한화생명: "PC",
  스팀대작: "PC",
  던전앤파이터: "PC",
  로스트아크: "PC",
  서든어택: "PC",
  스타크래프트: "PC",
  카트라이더: "모바일/PC",
  쿠키런: "모바일",
  쿠키런킹덤: "모바일",
  브롤스타즈: "모바일",
  포켓몬유나이트: "모바일/콘솔",
  디아블로: "PC/콘솔",
  패스오브엑자일: "PC",
  엘든링: "PC/콘솔",
  gta: "PC/콘솔",
  동물의숲: "콘솔",
  젤다의전설: "콘솔",
  닌텐도스위치: "콘솔",
  리니지m: "모바일",
  리니지w: "모바일",
  리니지2m: "모바일",
  오딘: "모바일",
  로열매치: "모바일",
  붕괴스타레일: "모바일/PC",
  젠레스존제로: "모바일/PC",
  명일방주: "모바일",
  우마무스메: "모바일",
  스플래툰: "콘솔",
  마리오카트: "콘솔",
};

function normalizeGameName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}]/g, "");
}

function classifyGamePlatform(name: string): GamePlatformTag {
  const key = normalizeGameName(name);
  if (GAME_PLATFORM_BY_NAME[key]) return GAME_PLATFORM_BY_NAME[key];

  for (const [seed, tag] of Object.entries(GAME_PLATFORM_BY_NAME)) {
    if (key.includes(seed) || seed.includes(key)) return tag;
  }

  if (/리니지m|쿠키런|브롤|모바일|로얄|오딘|명일방주|우마무스메/.test(key)) return "모바일";
  if (/젤다|동물의숲|닌텐도|스위치|플스|ps5|스플래툰|마리오/.test(key)) return "콘솔";
  if (/t1|젠지|한화|lck|e스포츠|esports/.test(key)) return "PC";
  return "PC";
}

export function platformForGame(name: string | undefined): GamePlatformTag | undefined {
  if (!name?.trim()) return undefined;
  return classifyGamePlatform(name);
}

export function entityPlatform(entity: Pick<RankingEntity, "name" | "platform" | "slug" | "heatmapGroup">): string | undefined {
  if (entity.platform) return entity.platform;
  const slug = entity.slug ?? "";
  const group = entity.heatmapGroup ?? "";
  if (slug.startsWith("game-esports-ranking") || group === "게임 e스포츠") {
    return platformForGame(entity.name);
  }
  return undefined;
}

export function formatEntityName(entity: Pick<RankingEntity, "name" | "platform" | "slug" | "heatmapGroup">): string {
  const platform = entityPlatform(entity);
  return platform ? `[${platform}] ${entity.name}` : entity.name;
}

export function formatPlatformTag(platform: string): string {
  const cleaned = platform.replace(/\s*게임/g, "").trim();
  return `[${cleaned} 게임]`;
}
