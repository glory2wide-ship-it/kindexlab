import type { PoliticsEntityType } from "@/lib/politics/types";

export interface PoliticsYoutubeSeed {
  name: string;
  nameEn: string;
  /** YouTube channel ID (UC…). Extra IDs can be appended via POLITICS_YOUTUBE_SEED_IDS. */
  channelId: string;
  handle?: string;
  aliases: string[];
  /** Always appear on the 정치 유튜브 랭킹 heatmap, even as news/media. */
  influencer: boolean;
  types: PoliticsEntityType[];
}

/**
 * Master seed list for large Korean politics/current-affairs channels.
 * These are collected regardless of category filters on the trending feed.
 * Keep ≥20 influencer seeds so the heatmap can fill top-20 tiles.
 */
export const POLITICS_YOUTUBE_SEEDS: PoliticsYoutubeSeed[] = [
  {
    name: "김어준의 겸손은 힘들다 뉴스공장",
    nameEn: "Kim Eo-jun News Factory",
    channelId: "UCAAvO0ehWox1bbym3rXKBZw",
    handle: "@gyeomsonisnothing",
    aliases: ["김어준", "뉴스공장", "겸손은 힘들다", "겸손은힘들다", "김어준의 뉴스공장"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "김용민TV",
    nameEn: "Kim Yong-min TV",
    channelId: "UCljnbFCt-4doBr7wtEIIbbw",
    aliases: ["김용민"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "가로세로연구소",
    nameEn: "Garosero Research",
    channelId: "UC0M-_02RJqMlGTKUjF1WhJg",
    aliases: ["가세연", "김세의"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "신의한수",
    nameEn: "Shinui Hansu",
    channelId: "UCgOLQwRv1r2m9mhE1tfsn3Q",
    aliases: ["신의 한 수", "신혜식"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "딴지방송국",
    nameEn: "Ddanzi Broadcast",
    channelId: "UCxvU6bRtYhNLvZleAIGa-FQ",
    aliases: ["딴지일보", "딴지"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "펜앤드마이크",
    nameEn: "PenN Mike",
    channelId: "UCOqCunaF9qVN8bXwsK0HT3g",
    aliases: ["펜앤마이크", "펜앤마이크TV", "정규재"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "이봉규TV",
    nameEn: "Lee Bong-kyu TV",
    channelId: "UCxuf3GXK290vcpFW0lxm0Uw",
    aliases: ["이봉규"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "매불쇼",
    nameEn: "Maebul Show",
    channelId: "UCMYhq9OyGI5UEz_NTAoHY7A",
    handle: "@maebulshow",
    aliases: ["최욱", "매불쇼 라이브"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "고성국TV",
    nameEn: "Ko Sung-kuk TV",
    channelId: "UCM8BcGB6BWKq3utIMhGKnUA",
    handle: "@고성국tv",
    aliases: ["고성국"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "황희두TV",
    nameEn: "Hwang Hee-doo TV",
    channelId: "UCfjrVFRB_mTNU8iFtD7yAnA",
    handle: "@heenimhwang",
    aliases: ["황희두", "알리미 황희두", "알리미황희두"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "열린공감TV",
    nameEn: "Open Empathy TV",
    channelId: "UC4y2Jx26qCb7CrSt_i5bf1A",
    handle: "@openmindtv11",
    aliases: ["열린공감"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "장성민의 시사탱크",
    nameEn: "Jang Sung-min Current Affairs Tank",
    channelId: "",
    aliases: ["시사탱크", "장성민"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "전원책TV",
    nameEn: "Jeon Won-chaek TV",
    channelId: "UCepZn-yku0hP4WGp1htXg-g",
    handle: "@tv-xg4ke",
    aliases: ["전원책", "전원책TV망명방송"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "뉴스타파",
    nameEn: "Newstapa",
    channelId: "UCeFUGS2VCOb6DO3BiUgvwNA",
    handle: "@news_tapa",
    aliases: ["한국탐사저널리즘센터", "Newstapa"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "오마이뉴스TV",
    nameEn: "OhmyNews TV",
    channelId: "UClAfLVQYZSLrMAQQ_SXPVZw",
    handle: "@ohmynewstv",
    aliases: ["오마이뉴스", "오마이TV"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "민중의소리",
    nameEn: "Voice of the People",
    channelId: "UCLiK08tsWKL5bNoz1f8sHsw",
    handle: "@mediavop",
    aliases: ["민소", "MediaVop"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "시사타파",
    nameEn: "Sisa Tapa",
    channelId: "",
    aliases: [],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "여의도스토리",
    nameEn: "Yeouido Story",
    channelId: "",
    aliases: ["여의도 스토리"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "정치인 숏츠",
    nameEn: "Politician shorts",
    channelId: "",
    aliases: ["정치숏츠"],
    influencer: true,
    types: ["political_influencer"],
  },
  {
    name: "시사 클립",
    nameEn: "Current-affairs clips",
    channelId: "",
    aliases: ["시사클립"],
    influencer: true,
    types: ["political_influencer"],
  },
];

const CHANNEL_ID_RE = /^UC[\w-]{20,}$/;

export function extraPoliticsYoutubeChannelIds(): string[] {
  const raw = process.env.POLITICS_YOUTUBE_SEED_IDS ?? "";
  return raw
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter((id) => CHANNEL_ID_RE.test(id));
}

export function politicsYoutubeChannelIds(): string[] {
  const known = POLITICS_YOUTUBE_SEEDS.map((seed) => seed.channelId).filter((id) => CHANNEL_ID_RE.test(id));
  return [...new Set([...known, ...extraPoliticsYoutubeChannelIds()])];
}

export function influencerSeedNames(): string[] {
  return POLITICS_YOUTUBE_SEEDS.filter((seed) => seed.influencer).map((seed) => seed.name);
}

export function matchPoliticsYoutubeSeed(text: string): PoliticsYoutubeSeed | undefined {
  const hay = text.replace(/\s+/g, "");
  return POLITICS_YOUTUBE_SEEDS.find((seed) => {
    const names = [seed.name, seed.nameEn, ...seed.aliases];
    return names.some((name) => {
      const compact = name.replace(/\s+/g, "");
      return compact && (hay.includes(compact) || text.includes(name));
    });
  });
}
