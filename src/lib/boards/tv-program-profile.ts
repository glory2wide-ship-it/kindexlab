/**
 * TV programme detail facts for /ranking/[slug] pages.
 * Curated profiles + light inference (channel from tags/name).
 */

import { inferTvGenre, TV_GENRE_LABEL, type TvGenreSegment } from "@/lib/boards/tv-genre";
import { inferTvChannelChip } from "@/lib/heatmap-rank-meta";
import type { RankingEntity } from "@/lib/types";

export type TvProgramProfile = {
  /** Matched catalogue title (may differ slightly from entity.name). */
  title: string;
  channel: string;
  /** Most recent first-run slot, e.g. "금·토 오후 9:10". */
  lastBroadcast: string;
  /** Rerun / encore slot when known. */
  rerunTime?: string;
  cast: string[];
  plotSummary: string;
  genre?: TvGenreSegment;
};

const PROFILES: TvProgramProfile[] = [
  {
    title: "선재 업고 튀어",
    channel: "tvN",
    lastBroadcast: "금·토 오후 8:40",
    rerunTime: "일 오후 12:00 (본편 재방송)",
    cast: ["변우석", "김혜윤", "송건희"],
    plotSummary:
      "열아홉 선재의 죽음을 목격한 임솔이 시간이 꼬인 현실에서 그를 살리기 위해 고군분투하는 로맨스 판타지 드라마.",
    genre: "drama",
  },
  {
    title: "눈물의 여왕",
    channel: "tvN",
    lastBroadcast: "토·일 오후 9:20",
    rerunTime: "월 오후 4:00 (재방송)",
    cast: ["김수현", "김지원", "박성훈"],
    plotSummary:
      "재벌 3세 홍해인과 별볼일 없던 백현우의 결혼 생활이 위기에 놓이며, 두 사람이 진짜 사랑을 마주하는 멜로 드라마.",
    genre: "drama",
  },
  {
    title: "폭싹 속았수다",
    channel: "Netflix",
    lastBroadcast: "시즌 단위 공개 (OTT)",
    cast: ["이지은", "박보검"],
    plotSummary:
      "제주를 배경으로 한 시대극. 가난과 차별 속에서도 서로를 지키며 성장하는 이들의 인생 서사를 그린 넷플릭스 오리지널.",
    genre: "ott",
  },
  {
    title: "더 글로리",
    channel: "Netflix",
    lastBroadcast: "시즌 단위 공개 (OTT)",
    cast: ["송혜교", "이도현", "임지연"],
    plotSummary:
      "학교 폭력 피해자가 치밀한 복수 계획을 실행하며 가해자들과 그를 방조한 세상을 마주하는 복수극.",
    genre: "ott",
  },
  {
    title: "오징어 게임",
    channel: "Netflix",
    lastBroadcast: "시즌 단위 공개 (OTT)",
    cast: ["이정재", "박해수", "위하준"],
    plotSummary:
      "거대한 상금을 걸고 어린이 게임에 참가한 사람들이 목숨 건 서바이벌에 뛰어드는 디스토피아 스릴러.",
    genre: "ott",
  },
  {
    title: "무빙",
    channel: "디즈니+",
    lastBroadcast: "시즌 단위 공개 (OTT)",
    cast: ["류승룡", "한효주", "조인성", "고윤정"],
    plotSummary:
      "초능력을 숨긴 부모와 아이들이 국가와 조직의 추적으로부터 서로를 지키려는 액션 히어로 드라마.",
    genre: "ott",
  },
  {
    title: "나 혼자 산다",
    channel: "MBC",
    lastBroadcast: "금 오후 11:10",
    rerunTime: "토 오후 5:00 (재방송)",
    cast: ["전현무", "박나래", "키", "코드 쿤스트"],
    plotSummary:
      "혼자 사는 연예인들의 일상과 취향을 관찰하며 공감과 웃음을 전하는 라이프스타일 예능.",
    genre: "variety",
  },
  {
    title: "미운 우리 새끼",
    channel: "SBS",
    lastBroadcast: "일 오후 9:00",
    rerunTime: "월 오전 11:00 (재방송)",
    cast: ["신동엽", "서장훈", "탁재훈"],
    plotSummary:
      "아직 결혼하지 않은 아들들의 일상을 어머니와 함께 지켜보며 세대 공감을 그리는 토크·관찰 예능.",
    genre: "variety",
  },
  {
    title: "런닝맨",
    channel: "SBS",
    lastBroadcast: "일 오후 6:15",
    rerunTime: "월 오후 1:00 (재방송)",
    cast: ["유재석", "김종국", "지석진", "하하", "양세찬", "전소민"],
    plotSummary:
      "미션과 추리, 레이스를 결합한 야외 버라이어티. 멤버들의 케미와 게스트 대결이 핵심 재미.",
    genre: "variety",
  },
  {
    title: "유 퀴즈 온 더 블럭",
    channel: "tvN",
    lastBroadcast: "수 오후 8:40",
    rerunTime: "목 오후 3:00 (재방송)",
    cast: ["유재석", "조세호"],
    plotSummary:
      "거리 인터뷰와 스튜디오 토크를 오가며 평범한 이웃과 유명 인사의 이야기를 풀어내는 토크 예능.",
    genre: "variety",
  },
  {
    title: "나는 솔로",
    channel: "SBS Plus",
    lastBroadcast: "수 오후 10:30",
    cast: ["데프콘", "송해나"],
    plotSummary: "돌싱·미혼 출연자들이 짧은 만남 속에서 인연을 찾아가는 데이팅 리얼리티.",
    genre: "variety",
  },
  {
    title: "1박 2일",
    channel: "KBS2",
    lastBroadcast: "일 오후 6:25",
    rerunTime: "월 오후 12:00 (재방송)",
    cast: ["김종민", "연정훈", "문세윤", "딘딘", "나인우"],
    plotSummary:
      "전국을 돌며 미션과 숙박을 소화하는 여행 버라이어티. 멤버 간의 티키타카가 장기 흥행 비결.",
    genre: "variety",
  },
  {
    title: "솔로지옥",
    channel: "Netflix",
    lastBroadcast: "시즌 단위 공개 (OTT)",
    cast: ["홍진경", "규현", "한해", "이미주"],
    plotSummary:
      "지옥섬과 천국 리조트를 오가며 연인을 선택하는 데이팅 서바이벌. 직진 화법이 화제.",
    genre: "ott",
  },
  {
    title: "환승연애",
    channel: "TVING",
    lastBroadcast: "시즌 단위 공개 (OTT)",
    cast: [],
    plotSummary:
      "이별한 연인들이 한집에 모여 새로운 인연과 옛 감정을 동시에 마주하는 데이팅 리얼리티.",
    genre: "ott",
  },
  {
    title: "이상한 변호사 우영우",
    channel: "ENA",
    lastBroadcast: "수·목 오후 9:00",
    cast: ["박은빈", "강태오", "강기영"],
    plotSummary:
      "자폐 스펙트럼을 가진 천재 변호사 우영우가 편견을 뚫고 사건을 해결하며 성장하는 법정 드라마.",
    genre: "drama",
  },
  {
    title: "사랑이온다",
    channel: "KBS1",
    lastBroadcast: "월~금 오후 8:30",
    rerunTime: "익일 오전 9:00 (재방송)",
    cast: [],
    plotSummary:
      "일일드라마. 가족·연애·생계의 갈등을 밀도 있게 그리며 생활밀착형 서사를 이어간다.",
    genre: "drama",
  },
  {
    title: "여보 미안해",
    channel: "KBS1",
    lastBroadcast: "월~금 오후 8:30",
    rerunTime: "익일 오전 9:00 (재방송)",
    cast: [],
    plotSummary:
      "부부·가족 갈등을 중심으로 한 일일극. 세대 간 오해와 화해가 반복되는 홈 멜로.",
    genre: "drama",
  },
  {
    title: "D.P.",
    channel: "Netflix",
    lastBroadcast: "시즌 단위 공개 (OTT)",
    cast: ["정해인", "구교환", "김성균"],
    plotSummary:
      "탈영병을 추적하는 군무 이탈 체포조 이야기. 군대 내 부조리를 날카롭게 해부한 밀리터리 드라마.",
    genre: "ott",
  },
  {
    title: "마스크걸",
    channel: "Netflix",
    lastBroadcast: "시즌 단위 공개 (OTT)",
    cast: ["고민시", "안재홍", "이한별"],
    plotSummary:
      "외모 콤플렉스를 숨긴 채 이중생활을 하던 주인공이 예상치 못한 사건에 휘말리며 정체성이 붕괴하는 스릴러.",
    genre: "ott",
  },
  {
    title: "중증외상센터",
    channel: "Netflix",
    lastBroadcast: "시즌 단위 공개 (OTT)",
    cast: ["주지훈", "추영우", "하영"],
    plotSummary:
      "최악 조건의 중증외상센터에서 벌어지는 수술과 생존의 기록. 의료 현장의 긴장감을 전면화한 드라마.",
    genre: "ott",
  },
  {
    title: "재벌X형사2",
    channel: "MBC",
    lastBroadcast: "금·토 오후 9:50",
    rerunTime: "일 오후 3:00 (재방송)",
    cast: ["안보현", "박지현"],
    plotSummary:
      "재벌 형사와 파트너가 미스터리 사건을 추적하는 범죄 수사 드라마. 시즌2에서 새로운 사건을 다룬다.",
    genre: "drama",
  },
];

function compact(value: string): string {
  return value.replace(/\s+/g, "").replace(/[·._\-]/g, "").toLowerCase();
}

function profileMatchScore(name: string, title: string): number {
  const a = compact(name);
  const b = compact(title);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  return 0;
}

export function lookupTvProgramProfile(name: string): TvProgramProfile | undefined {
  let best: TvProgramProfile | undefined;
  let bestScore = 0;
  for (const profile of PROFILES) {
    const score = profileMatchScore(name, profile.title);
    if (score > bestScore) {
      best = profile;
      bestScore = score;
    }
  }
  return bestScore >= 80 ? best : undefined;
}

export function buildTvProgramProfile(
  entity: Pick<
    RankingEntity,
    "name" | "nameEn" | "type" | "slug" | "tags" | "summary" | "heatmapGroup"
  >,
): TvProgramProfile | undefined {
  const slug = entity.slug ?? "";
  const isTv =
    entity.type === "tv_show" ||
    entity.type === "tv_rating" ||
    slug.startsWith("realtime-tv-ratings") ||
    slug.startsWith("ott-buzz-ranking") ||
    entity.heatmapGroup === "TV 시청률" ||
    entity.heatmapGroup === "OTT 화제성";
  if (!isTv) return undefined;

  const catalog = lookupTvProgramProfile(entity.name);
  const channel =
    catalog?.channel ||
    inferTvChannelChip(entity) ||
    (entity.tags ?? []).find((tag) =>
      /^(KBS|MBC|SBS|JTBC|tvN|TV조선|채널A|MBN|ENA|Netflix|티빙|웨이브|디즈니)/i.test(tag),
    ) ||
    "편성 정보 확인 중";

  const genre =
    catalog?.genre ||
    inferTvGenre(entity.name, { tags: entity.tags, nameEn: entity.nameEn });

  if (catalog) {
    return {
      ...catalog,
      channel,
      genre,
      plotSummary:
        catalog.plotSummary ||
        entity.summary ||
        `${entity.name}의 최근 방송 화제와 시청 반응을 요약한 해설입니다.`,
    };
  }

  return {
    title: entity.name,
    channel,
    lastBroadcast:
      genre === "ott" ? "OTT 공개 일정 (플랫폼 공지 기준)" : "최근 본방송 시각 집계 중",
    rerunTime: genre === "ott" ? undefined : "재방송 시각 집계 중",
    cast: [],
    plotSummary:
      entity.summary?.trim() ||
      `${entity.name}의 핵심 줄거리와 회차 하이라이트는 방송사·OTT 공식 소개를 기준으로 요약됩니다.`,
    genre,
  };
}

export function tvProgramGenreLabel(genre: TvGenreSegment | undefined): string | undefined {
  return genre ? TV_GENRE_LABEL[genre] : undefined;
}
