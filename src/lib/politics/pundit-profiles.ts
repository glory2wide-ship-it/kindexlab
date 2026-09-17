/**
 * Static detail pack for 정치평론가 — official YouTube UC + SNS profile URLs.
 * SNS has no reliable free live API; profile links are the durable signal.
 */

export type PunditProfileSeed = {
  name: string;
  aliases?: string[];
  role?: string;
  /** YouTube channel ID (UC…). Empty = resolve via search only as last resort. */
  youtubeChannelId?: string;
  youtubeUrl?: string;
  sns?: Array<{ label: string; href: string }>;
};

export const PUNDIT_PROFILE_SEEDS: PunditProfileSeed[] = [
  {
    name: "유시민",
    aliases: ["알릴레오"],
    role: "작가·방송인",
    youtubeChannelId: "UCepgG4LxcUoa40xYXDq3uOw",
    youtubeUrl: "https://www.youtube.com/channel/UCepgG4LxcUoa40xYXDq3uOw",
    sns: [{ label: "알릴레오 유튜브", href: "https://www.youtube.com/channel/UCepgG4LxcUoa40xYXDq3uOw" }],
  },
  {
    name: "진중권",
    aliases: ["시사평론가"],
    role: "시사평론가",
    sns: [],
  },
  {
    name: "전원책",
    role: "시사평론가",
    youtubeChannelId: "UCepZn-yku0hP4WGp1htXg-g",
    youtubeUrl: "https://www.youtube.com/channel/UCepZn-yku0hP4WGp1htXg-g",
    sns: [],
  },
  {
    name: "김종배",
    aliases: ["시사자키"],
    role: "시사자키",
    sns: [],
  },
  {
    name: "황희두",
    aliases: ["황희두TV", "알리미 황희두"],
    role: "시사평론가",
    youtubeChannelId: "UCfjrVFRB_mTNU8iFtD7yAnA",
    youtubeUrl: "https://www.youtube.com/channel/UCfjrVFRB_mTNU8iFtD7yAnA",
    sns: [],
  },
  {
    name: "배종찬",
    aliases: ["여론조사"],
    role: "여론조사",
    sns: [],
  },
  {
    name: "박성민",
    aliases: ["정치컨설턴트"],
    role: "정치컨설턴트",
    sns: [],
  },
  {
    name: "김근식",
    role: "시사평론가",
    sns: [],
  },
  {
    name: "이종훈",
    role: "시사평론가",
    sns: [],
  },
  {
    name: "최진봉",
    role: "시사평론가",
    sns: [],
  },
  {
    name: "장성철",
    role: "시사평론가",
    sns: [],
  },
  {
    name: "조기숙",
    role: "시사평론가",
    sns: [],
  },
  {
    name: "금태섭",
    role: "시사평론가",
    sns: [],
  },
  {
    name: "김경율",
    aliases: ["경제정의"],
    role: "경제정의",
    sns: [],
  },
  {
    name: "서정욱",
    role: "시사평론가",
    sns: [],
  },
];

export function matchPunditProfileSeed(text: string): PunditProfileSeed | undefined {
  const needle = text.replace(/\s+/g, "").toLowerCase();
  return PUNDIT_PROFILE_SEEDS.find((seed) => {
    const names = [seed.name, ...(seed.aliases ?? [])].map((n) =>
      n.replace(/\s+/g, "").toLowerCase(),
    );
    return names.some((n) => needle.includes(n) || n.includes(needle));
  });
}
