/**
 * Entertainment detail facts shown inside EntityHero (rank / 시가 box).
 *
 * Domains: KPOP · 음원 · 스타 · 영화 · 웹툰 · 공연 · 전시팝업
 * Refresh policy: curated rows carry `checkedAt` (KST). A weekly cron
 * (`/api/cron/entertainment-facts`) flags profiles older than 7 days so
 * editors can update members, agencies, hits, cast, synopsis, venue, etc.
 */

import { entityNarrativeSummary } from "@/lib/entity/index-blurb";
import type { EntityType, RankingEntity } from "@/lib/types";

export type EntertainmentFactRow = { label: string; value: string };

export type EntertainmentFacts = {
  domain:
    | "kpop"
    | "music"
    | "star"
    | "movie"
    | "webtoon"
    | "performance"
    | "exhibition";
  /** Optional chips (members / cast / hit songs). */
  chips?: Array<{ label: string; items: string[] }>;
  rows: EntertainmentFactRow[];
  synopsis?: string;
  /** ISO timestamp of last curated review (Asia/Seoul). */
  checkedAt: string;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Last catalogue-wide review date — bump when editors refresh the pack. */
export const ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT = "2026-09-14T09:00:00+09:00";

export function entertainmentFactsAreStale(
  checkedAt: string,
  now = Date.now(),
): boolean {
  const ts = Date.parse(checkedAt);
  if (!Number.isFinite(ts)) return true;
  return now - ts > WEEK_MS;
}

function compact(value: string): string {
  return value.replace(/\s+/g, "").replace(/[·._\-'"‘’“”]/g, "").toLowerCase();
}

function matchScore(name: string, title: string): number {
  const a = compact(name);
  const b = compact(title);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  return 0;
}

type CatalogEntry = {
  title: string;
  aliases?: string[];
  domain: EntertainmentFacts["domain"];
  rows: EntertainmentFactRow[];
  chips?: Array<{ label: string; items: string[] }>;
  synopsis?: string;
  checkedAt?: string;
};

const CATALOG: CatalogEntry[] = [
  // —— KPOP groups ——
  {
    title: "BTS",
    aliases: ["방탄소년단", "Bangtan"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "HYBE (빅히트 뮤직)" },
      { label: "데뷔", value: "2013.06.13" },
    ],
    chips: [
      {
        label: "멤버",
        items: ["RM", "진", "슈가", "제이홉", "지민", "뷔", "정국"],
      },
      {
        label: "최근 히트곡",
        items: ["Dynamite", "Butter", "Permission to Dance", "Yet To Come"],
      },
    ],
    synopsis: "세계적 신드롬을 만든 7인조 보이그룹. 음원·공연·팬덤 파워를 동시에 견인한다.",
  },
  {
    title: "BLACKPINK",
    aliases: ["블랙핑크"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "YG 엔터테인먼트" },
      { label: "데뷔", value: "2016.08.08" },
    ],
    chips: [
      { label: "멤버", items: ["지수", "제니", "로제", "리사"] },
      {
        label: "최근 히트곡",
        items: ["Pink Venom", "Shut Down", "How You Like That", "Typa Girl"],
      },
    ],
  },
  {
    title: "NewJeans",
    aliases: ["뉴진스"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "ADOR (HYBE)" },
      { label: "데뷔", value: "2022.07.22" },
    ],
    chips: [
      { label: "멤버", items: ["민지", "하니", "다니엘", "해린", "혜인"] },
      {
        label: "최근 히트곡",
        items: ["Super Shy", "ETA", "How Sweet", "Bubble Gum"],
      },
    ],
  },
  {
    title: "IVE",
    aliases: ["아이브"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "스타쉽 엔터테인먼트" },
      { label: "데뷔", value: "2021.12.01" },
    ],
    chips: [
      {
        label: "멤버",
        items: ["안유진", "가을", "레이", "장원영", "리즈", "이서"],
      },
      {
        label: "최근 히트곡",
        items: ["IVE SWITCH", "HEYA", "Baddie", "Accendio"],
      },
    ],
  },
  {
    title: "aespa",
    aliases: ["에스파"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "SM 엔터테인먼트" },
      { label: "데뷔", value: "2020.11.17" },
    ],
    chips: [
      { label: "멤버", items: ["카리나", "지젤", "윈터", "닝닝"] },
      {
        label: "최근 히트곡",
        items: ["Supernova", "Armageddon", "Drama", "Spicy"],
      },
    ],
  },
  {
    title: "SEVENTEEN",
    aliases: ["세븐틴"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "PLEDIS (HYBE)" },
      { label: "데뷔", value: "2015.05.26" },
    ],
    chips: [
      {
        label: "멤버",
        items: [
          "에스쿱스",
          "정한",
          "조슈아",
          "준",
          "호시",
          "원우",
          "우지",
          "디에잇",
          "민규",
          "도겸",
          "명호",
          "디노",
          "버논",
        ],
      },
      {
        label: "최근 히트곡",
        items: ["MAESTRO", "LALALI", "God of Music", "Hot"],
      },
    ],
  },
  {
    title: "Stray Kids",
    aliases: ["스트레이키즈", "스키즈"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "JYP 엔터테인먼트" },
      { label: "데뷔", value: "2018.03.25" },
    ],
    chips: [
      {
        label: "멤버",
        items: ["방찬", "리노", "창빈", "현진", "한", "필릭스", "승민", "아이엔"],
      },
      {
        label: "최근 히트곡",
        items: ["Chk Chk Boom", "LALALALA", "S-Class", "God's Menu"],
      },
    ],
  },
  {
    title: "TWICE",
    aliases: ["트와이스"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "JYP 엔터테인먼트" },
      { label: "데뷔", value: "2015.10.20" },
    ],
    chips: [
      {
        label: "멤버",
        items: ["나연", "정연", "모모", "사나", "지효", "미나", "다현", "채영", "쯔위"],
      },
      {
        label: "최근 히트곡",
        items: ["ONE SPARK", "Set Me Free", "Talk that Talk", "Scientist"],
      },
    ],
  },
  {
    title: "LE SSERAFIM",
    aliases: ["르세라핌"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "SOURCE MUSIC (HYBE)" },
      { label: "데뷔", value: "2022.05.02" },
    ],
    chips: [
      { label: "멤버", items: ["사쿠라", "김채원", "허윤진", "카즈하", "홍은채"] },
      {
        label: "최근 히트곡",
        items: ["EASY", "Smart", "Perfect Night", "UNFORGIVEN"],
      },
    ],
  },
  {
    title: "ILLIT",
    aliases: ["아일릿"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "BELIFT LAB (HYBE)" },
      { label: "데뷔", value: "2024.03.25" },
    ],
    chips: [
      { label: "멤버", items: ["윤아", "민주", "모카", "원희", "이로하"] },
      {
        label: "최근 히트곡",
        items: ["Magnetic", "Cherish (My Love)", "Lucky Girl Syndrome"],
      },
    ],
  },
  {
    title: "(G)I-DLE",
    aliases: ["여자아이들", "지아이들"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "큐브 엔터테인먼트" },
      { label: "데뷔", value: "2018.05.02" },
    ],
    chips: [
      { label: "멤버", items: ["미연", "민니", "소연", "우기", "슈화"] },
      {
        label: "최근 히트곡",
        items: ["Klaxon", "Super Lady", "Queencard", "Nxde"],
      },
    ],
  },
  {
    title: "TXT",
    aliases: ["투모로우바이투게더", "Tomorrow X Together"],
    domain: "kpop",
    rows: [
      { label: "소속사", value: "빅히트 뮤직 (HYBE)" },
      { label: "데뷔", value: "2019.03.04" },
    ],
    chips: [
      { label: "멤버", items: ["수빈", "연준", "범규", "태현", "휴닝카이"] },
      {
        label: "최근 히트곡",
        items: ["Deja Vu", "Sugar Rush Ride", "Good Boy Gone Bad", "0X1=LOVESONG"],
      },
    ],
  },

  // —— Music tracks / artists ——
  {
    title: "APT.",
    aliases: ["아파트", "Apt"],
    domain: "music",
    rows: [
      { label: "아티스트", value: "로제 (ROSÉ), Bruno Mars" },
      { label: "소속사", value: "THE BLACK LABEL / Atlantic" },
      { label: "앨범", value: "rosie" },
    ],
    synopsis: "로제와 브루노 마스의 글로벌 콜라보 히트곡. 국내외 음원 차트를 동시 강타했다.",
  },
  {
    title: "Magnetic",
    domain: "music",
    rows: [
      { label: "아티스트", value: "ILLIT" },
      { label: "소속사", value: "BELIFT LAB (HYBE)" },
      { label: "앨범", value: "SUPER REAL ME" },
    ],
  },
  {
    title: "Supernova",
    domain: "music",
    rows: [
      { label: "아티스트", value: "aespa" },
      { label: "소속사", value: "SM 엔터테인먼트" },
      { label: "앨범", value: "Armageddon" },
    ],
  },
  {
    title: "How Sweet",
    domain: "music",
    rows: [
      { label: "아티스트", value: "NewJeans" },
      { label: "소속사", value: "ADOR (HYBE)" },
      { label: "앨범", value: "How Sweet" },
    ],
  },
  {
    title: "SPOT!",
    aliases: ["스팟"],
    domain: "music",
    rows: [
      { label: "아티스트", value: "지코 (Feat. 제니)" },
      { label: "소속사", value: "KOZ 엔터테인먼트" },
    ],
  },
  {
    title: "해야",
    aliases: ["HEYA"],
    domain: "music",
    rows: [
      { label: "아티스트", value: "IVE" },
      { label: "소속사", value: "스타쉽 엔터테인먼트" },
      { label: "앨범", value: "IVE SWITCH" },
    ],
  },
  {
    title: "에피소드",
    aliases: ["Episode"],
    domain: "music",
    rows: [
      { label: "아티스트", value: "이무진" },
      { label: "소속사", value: "어비스 컴퍼니" },
    ],
  },
  {
    title: "Love wins all",
    domain: "music",
    rows: [
      { label: "아티스트", value: "아이유" },
      { label: "소속사", value: "이담 엔터테인먼트" },
      { label: "앨범", value: "The Winning" },
    ],
  },

  // —— Stars / celebrities ——
  {
    title: "김수현",
    domain: "star",
    rows: [
      { label: "소속사", value: "골드메달리스트" },
      { label: "직업", value: "배우" },
    ],
    chips: [
      {
        label: "출연작품",
        items: ["눈물의 여왕", "사이코지만 괜찮아", "나의 아저씨", "태양의 후예"],
      },
    ],
  },
  {
    title: "김지원",
    domain: "star",
    rows: [
      { label: "소속사", value: "아스트렐라리오" },
      { label: "직업", value: "배우" },
    ],
    chips: [
      {
        label: "출연작품",
        items: ["눈물의 여왕", "나의 해방일지", "아르테미스", "상속자들"],
      },
    ],
  },
  {
    title: "변우석",
    domain: "star",
    rows: [
      { label: "소속사", value: "바인엔터테인먼트" },
      { label: "직업", value: "배우" },
    ],
    chips: [
      {
        label: "출연작품",
        items: ["선재 업고 튀어", "강한여자 강남순", "솔로지옥"],
      },
    ],
  },
  {
    title: "김혜윤",
    domain: "star",
    rows: [
      { label: "소속사", value: "아이오케이컴퍼니" },
      { label: "직업", value: "배우" },
    ],
    chips: [
      {
        label: "출연작품",
        items: ["선재 업고 튀어", "스물다섯 스물하나", "하늘에서 내리는 일억개의 별"],
      },
    ],
  },
  {
    title: "한소희",
    domain: "star",
    rows: [
      { label: "소속사", value: "네모이엔티" },
      { label: "직업", value: "배우" },
    ],
    chips: [
      {
        label: "출연작품",
        items: ["더 글로리", "나의 해방일지", "그래도 돼", "구경이"],
      },
    ],
  },
  {
    title: "유재석",
    domain: "star",
    rows: [
      { label: "소속사", value: "안테나" },
      { label: "직업", value: "예능인·MC" },
    ],
    chips: [
      {
        label: "출연작품",
        items: ["유 퀴즈 온 더 블럭", "런닝맨", "놀면 뭐하니?", "해피투게더"],
      },
    ],
  },
  {
    title: "아이유",
    aliases: ["IU", "이지은"],
    domain: "star",
    rows: [
      { label: "소속사", value: "이담 엔터테인먼트" },
      { label: "직업", value: "가수·배우" },
    ],
    chips: [
      {
        label: "출연작품",
        items: ["호텔 델루나", "나의 아저씨", "드림", "사랑 후에 오는 것들"],
      },
    ],
  },
  {
    title: "손석구",
    domain: "star",
    rows: [
      { label: "소속사", value: "매니지먼트숲" },
      { label: "직업", value: "배우" },
    ],
    chips: [
      {
        label: "출연작품",
        items: ["범죄도시2", "범죄도시3", "D.P.", "카지노"],
      },
    ],
  },

  // —— Movies ——
  {
    title: "범죄도시4",
    aliases: ["범죄도시 4"],
    domain: "movie",
    rows: [
      { label: "감독", value: "허명행" },
      { label: "개봉", value: "2024.04.24" },
    ],
    chips: [
      { label: "출연", items: ["마동석", "김무열", "박지환", "이범수"] },
    ],
    synopsis:
      "괴물형사 마석도가 새로운 범죄 조직을 상대로 펼치는 액션 범죄 시리즈 네 번째 이야기.",
  },
  {
    title: "파묘",
    domain: "movie",
    rows: [
      { label: "감독", value: "장재현" },
      { label: "개봉", value: "2024.02.22" },
    ],
    chips: [
      { label: "출연", items: ["최민식", "김고은", "유해진", "이도현"] },
    ],
    synopsis:
      "수상한 묘를 이장하며 비롯된 기이한 사건을 추적하는 오컬트 미스터리.",
  },
  {
    title: "핸섬가이즈",
    domain: "movie",
    rows: [
      { label: "감독", value: "남동협" },
      { label: "개봉", value: "2024.06.26" },
    ],
    chips: [
      { label: "출연", items: ["이성민", "이희준", "공명"] },
    ],
    synopsis: "평범한 가장들이 뜻밖의 사건에 휘말리며 벌어지는 코미디 액션.",
  },
  {
    title: "인사이드 아웃 2",
    aliases: ["인사이드아웃2", "Inside Out 2"],
    domain: "movie",
    rows: [
      { label: "배급", value: "월트디즈니 컴퍼니 코리아" },
      { label: "개봉", value: "2024.06.12" },
    ],
    chips: [{ label: "출연(더빙)", items: ["라일리", "기쁨", "불안", "당황"] }],
    synopsis:
      "사춘기에 접어든 라일리의 머릿속에 새로운 감정들이 합류하며 벌어지는 성장 애니메이션.",
  },
  {
    title: "데드풀과 울버린",
    aliases: ["데드풀과울버린", "Deadpool & Wolverine"],
    domain: "movie",
    rows: [
      { label: "배급", value: "월트디즈니 컴퍼니 코리아" },
      { label: "개봉", value: "2024.07.24" },
    ],
    chips: [{ label: "출연", items: ["라이언 레이놀즈", "휴 잭맨"] }],
    synopsis: "데드풀이 울버린과 함께 타임라인 붕괴를 막기 위해 나서는 MCU 액션.",
  },
  {
    title: "탈출: 프로젝트 사일런스",
    aliases: ["프로젝트 사일런스"],
    domain: "movie",
    rows: [
      { label: "감독", value: "김태곤" },
      { label: "개봉", value: "2024.07.12" },
    ],
    chips: [{ label: "출연", items: ["이상윤", "주지훈", "김희원"] }],
    synopsis: "고속도로 위에서 벌어지는 생존 스릴러. 침묵의 재난과 인간 군상을 그린다.",
  },

  // —— Webtoons ——
  {
    title: "나 혼자만 레벨업",
    aliases: ["나혼렙", "Solo Leveling"],
    domain: "webtoon",
    rows: [
      { label: "플랫폼", value: "카카오페이지 / 카카오웹툰" },
      { label: "작가", value: "추공 (원작) · 장성락 (그림)" },
    ],
    chips: [{ label: "주요 인물", items: ["성진우", "차해인", "최종인"] }],
    synopsis:
      "최약체 헌터 성진우가 시스템 각성 후 혼자만 레벨업하며 최강으로 성장하는 판타지 액션.",
  },
  {
    title: "외모지상주의",
    aliases: ["외지주"],
    domain: "webtoon",
    rows: [
      { label: "플랫폼", value: "네이버 웹툰" },
      { label: "작가", value: "박태준" },
    ],
    chips: [{ label: "주요 인물", items: ["박형석", "이수호", "조빈"] }],
    synopsis:
      "못생긴 고등학생 박형석이 완벽한 외모로 변신할 수 있는 능력을 얻으며 벌어지는 학원 액션.",
  },
  {
    title: "퀘스트지상주의",
    domain: "webtoon",
    rows: [
      { label: "플랫폼", value: "네이버 웹툰" },
      { label: "작가", value: "박태준 만화회사 · 김휘" },
    ],
    chips: [{ label: "주요 인물", items: ["김수호"] }],
    synopsis: "일상에 퀘스트 창이 뜨며 강제 성장하는 고등학생의 학원 액션 판타지.",
  },
  {
    title: "김부장",
    domain: "webtoon",
    rows: [
      { label: "플랫폼", value: "네이버 웹툰" },
      { label: "작가", value: "박태준 만화회사 · 남궁세영" },
    ],
    chips: [{ label: "주요 인물", items: ["김부장", "이현성"] }],
    synopsis: "전설의 킬러 출신 김부장이 평범한 회사원으로 살며 과거의 적과 마주하는 액션.",
  },
  {
    title: "마루는 강쥐",
    domain: "webtoon",
    rows: [
      { label: "플랫폼", value: "네이버 웹툰" },
      { label: "작가", value: "모죠" },
    ],
    chips: [{ label: "주요 인물", items: ["마루", "집사"] }],
    synopsis: "강아지 마루와 집사의 일상 공감을 담은 힐링 코미디 웹툰.",
  },
  {
    title: "입학용병",
    domain: "webtoon",
    rows: [
      { label: "플랫폼", value: "네이버 웹툰" },
      { label: "작가", value: "YC · 락현" },
    ],
    chips: [{ label: "주요 인물", items: ["유이준"] }],
    synopsis: "용병 출신 전학생이 학교 폭력에 맞서는 학원 액션.",
  },
  {
    title: "절대검감",
    domain: "webtoon",
    rows: [
      { label: "플랫폼", value: "네이버 웹툰" },
      { label: "작가", value: "한중월야 · 장광남" },
    ],
    synopsis: "검의 재능을 잃은 검수가 절대검감을 각성하며 무림에 도전하는 무협.",
  },

  // —— Performances ——
  {
    title: "뮤지컬 웨스트사이드 스토리",
    aliases: ["웨스트사이드 스토리"],
    domain: "performance",
    rows: [
      { label: "공연 장소", value: "디큐브링크아트센터" },
      { label: "공연 일정", value: "2024.11 ~ 2025.02 (회차별 상이)" },
      { label: "공연 시간", value: "평일 19:30 · 주말 14:00/19:00" },
      { label: "티켓 가격", value: "R석 17만 ~ VIP 19만원대" },
    ],
    chips: [{ label: "출연", items: ["토니", "마리아", "애니타", "리프"] }],
    synopsis: "뉴욕을 배경으로 한 두 갱단과 사랑 이야기를 그린 클래식 뮤지컬.",
  },
  {
    title: "뮤지컬 팬텀",
    aliases: ["팬텀"],
    domain: "performance",
    rows: [
      { label: "공연 장소", value: "세종문화회관 대극장" },
      { label: "공연 일정", value: "시즌 공연 (공식 캘린더 기준)" },
      { label: "공연 시간", value: "평일 19:30 · 주말 14:00/19:00" },
      { label: "티켓 가격", value: "R석 14만 ~ VIP 18만원대" },
    ],
    chips: [{ label: "출연", items: ["팬텀", "크리스틴", "라울"] }],
    synopsis: "파리 오페라하우스를 배경으로 한 팬텀과 크리스틴의 운명적 사랑.",
  },
  {
    title: "연극 셰익스피어 인 러브",
    aliases: ["셰익스피어 인 러브"],
    domain: "performance",
    rows: [
      { label: "공연 장소", value: "예술의전당 CJ 토월극장" },
      { label: "공연 일정", value: "시즌 공연 (공식 캘린더 기준)" },
      { label: "공연 시간", value: "평일 19:30 · 주말 15:00" },
      { label: "티켓 가격", value: "R석 9만 ~ VIP 12만원대" },
    ],
    synopsis: "젊은 셰익스피어의 창작과 사랑을 그린 로맨틱 코미디 연극.",
  },
  {
    title: "콘서트 임영웅",
    aliases: ["임영웅 콘서트", "영웅시대"],
    domain: "performance",
    rows: [
      { label: "공연 장소", value: "올림픽공원 KSPO DOME 등" },
      { label: "공연 일정", value: "전국 투어 (회차별 공지)" },
      { label: "공연 시간", value: "18:00 또는 19:00 개막" },
      { label: "티켓 가격", value: "VIP 17만 ~ 지정석 11만원대" },
    ],
    chips: [{ label: "출연", items: ["임영웅"] }],
    synopsis: "트로트 스타 임영웅의 전국 투어 콘서트. 히트곡 메들리와 팬 소통이 중심.",
  },

  // —— Exhibition / popup ——
  {
    title: "반고흐 인사이드",
    aliases: ["반 고흐 인사이드", "Van Gogh Inside"],
    domain: "exhibition",
    rows: [
      { label: "행사 장소", value: "성수 / 여의도 등 순회 전시장" },
      { label: "행사 시간", value: "10:00–20:00 (입장마감 19:00)" },
      { label: "입장료", value: "성인 2만 ~ 2.5만원대" },
    ],
    synopsis: "고흐 명작을 미디어아트로 체험하는 몰입형 전시.",
  },
  {
    title: "디즈니 100년 전시",
    aliases: ["디즈니100", "Disney 100"],
    domain: "exhibition",
    rows: [
      { label: "행사 장소", value: "국립중앙박물관 / 특별전시장" },
      { label: "행사 시간", value: "10:00–18:00 (월요일 휴관)" },
      { label: "입장료", value: "성인 1.5만 ~ 2만원대" },
    ],
    synopsis: "디즈니 100주년 아카이브와 작품 세계를 조망하는 특별전.",
  },
  {
    title: "카카오 프렌즈 팝업",
    aliases: ["카카오프렌즈 팝업"],
    domain: "exhibition",
    rows: [
      { label: "행사 장소", value: "성수 / 홍대 팝업스토어" },
      { label: "행사 시간", value: "11:00–21:00" },
      { label: "입장료", value: "무료 (일부 체험 유료)" },
    ],
    synopsis: "시즌 캐릭터 상품과 포토존을 선보이는 브랜드 팝업.",
  },
  {
    title: "더현대 서울 팝업",
    aliases: ["더현대 팝업"],
    domain: "exhibition",
    rows: [
      { label: "행사 장소", value: "더현대 서울" },
      { label: "행사 시간", value: "백화점 영업시간 준수" },
      { label: "입장료", value: "무료~유료 (브랜드별)" },
    ],
    synopsis: "더현대 서울에서 열리는 시즌 브랜드 협업 팝업 전시·판매 공간.",
  },
];

const TYPE_DOMAIN: Partial<Record<EntityType, EntertainmentFacts["domain"]>> = {
  kpop: "kpop",
  music_chart: "music",
  celebrity: "star",
  movie: "movie",
  webtoon: "webtoon",
  performance: "performance",
  exhibition: "exhibition",
};

const SLUG_DOMAIN: Array<{ test: (slug: string) => boolean; domain: EntertainmentFacts["domain"] }> = [
  { test: (s) => s.startsWith("kpop-fandom-power"), domain: "kpop" },
  { test: (s) => s.startsWith("realtime-music-chart"), domain: "music" },
  { test: (s) => s.startsWith("star-reputation-index"), domain: "star" },
  { test: (s) => s.startsWith("boxoffice-expectation"), domain: "movie" },
  { test: (s) => s.startsWith("realtime-webtoon-rank"), domain: "webtoon" },
  { test: (s) => s.startsWith("performance-ticket-ranking"), domain: "performance" },
  { test: (s) => s.startsWith("exhibition-popup-ranking"), domain: "exhibition" },
];

function domainOf(entity: Pick<RankingEntity, "type" | "slug" | "heatmapGroup">): EntertainmentFacts["domain"] | undefined {
  // Prefer board slug so mis-tagged celebrity placeholders on non-ent boards
  // do not steal the weekly entertainment pack.
  const slug = entity.slug ?? "";
  for (const row of SLUG_DOMAIN) {
    if (row.test(slug)) return row.domain;
  }
  const fromType = TYPE_DOMAIN[entity.type];
  if (fromType) return fromType;
  const group = entity.heatmapGroup ?? "";
  if (/K\s*POP|케이팝|아이돌/i.test(group)) return "kpop";
  if (/음원/.test(group)) return "music";
  if (/스타|셀럽/.test(group)) return "star";
  if (/영화|박스오피스/.test(group)) return "movie";
  if (/웹툰/.test(group)) return "webtoon";
  if (/공연|뮤지컬|콘서트/.test(group)) return "performance";
  if (/전시|팝업/.test(group)) return "exhibition";
  return undefined;
}

function lookupCatalog(name: string, domain: EntertainmentFacts["domain"]): CatalogEntry | undefined {
  let best: CatalogEntry | undefined;
  let bestScore = 0;
  for (const entry of CATALOG) {
    if (entry.domain !== domain) continue;
    let score = matchScore(name, entry.title);
    for (const alias of entry.aliases ?? []) {
      score = Math.max(score, matchScore(name, alias));
    }
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return bestScore >= 80 ? best : undefined;
}

function inferWebtoonPlatform(name: string, tags: string[] | undefined): string | undefined {
  const blob = `${name} ${(tags ?? []).join(" ")}`;
  if (/네이버|naver/i.test(blob)) return "네이버 웹툰";
  if (/카카오페이지|카카오웹툰|kakao/i.test(blob)) return "카카오웹툰";
  if (/레진|lezhin/i.test(blob)) return "레진코믹스";
  if (/봄툰|bomtoon/i.test(blob)) return "봄툰";
  if (/리디|ridi/i.test(blob)) return "리디";
  return undefined;
}

function fallbackFacts(
  entity: Pick<RankingEntity, "name" | "tags" | "summary">,
  domain: EntertainmentFacts["domain"],
): EntertainmentFacts {
  const checkedAt = ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT;
  const tags = entity.tags ?? [];
  switch (domain) {
    case "kpop":
      return {
        domain,
        checkedAt,
        rows: [
          { label: "소속사", value: tags.find((t) => /엔터|HYBE|YG|JYP|SM|스타쉽|큐브|ADOR/i.test(t)) ?? "소속사 확인 중" },
          { label: "구분", value: "아이돌 그룹/아티스트" },
        ],
        chips: [
          { label: "멤버", items: [] },
          { label: "최근 히트곡", items: [] },
        ],
        synopsis:
          entityNarrativeSummary(entity) ||
          `${entity.name}의 멤버·소속사·히트곡 정보는 주 1회 갱신됩니다.`,
      };
    case "music":
      return {
        domain,
        checkedAt,
        rows: [
          { label: "아티스트", value: "가수/그룹 확인 중" },
          { label: "소속사", value: "소속사 확인 중" },
        ],
        synopsis:
          entityNarrativeSummary(entity) ||
          `${entity.name}의 아티스트·소속사 정보는 주 1회 갱신됩니다.`,
      };
    case "star":
      return {
        domain,
        checkedAt,
        rows: [
          { label: "소속사", value: "소속사 확인 중" },
          { label: "직업", value: tags.find((t) => /배우|가수|예능|모델/.test(t)) ?? "연예인" },
        ],
        chips: [{ label: "출연작품", items: [] }],
        synopsis:
          entityNarrativeSummary(entity) ||
          `${entity.name}의 소속사·출연작품 정보는 주 1회 갱신됩니다.`,
      };
    case "movie":
      return {
        domain,
        checkedAt,
        rows: [{ label: "개봉/배급", value: "정보 확인 중" }],
        chips: [{ label: "출연", items: [] }],
        synopsis:
          entityNarrativeSummary(entity) ||
          `${entity.name}의 출연진·시놉시스는 주 1회 갱신됩니다.`,
      };
    case "webtoon":
      return {
        domain,
        checkedAt,
        rows: [
          {
            label: "플랫폼",
            value: inferWebtoonPlatform(entity.name, tags) ?? "웹툰 플랫폼 확인 중",
          },
          { label: "작가", value: "작가 정보 확인 중" },
        ],
        chips: [{ label: "주요 인물", items: [] }],
        synopsis:
          entityNarrativeSummary(entity) ||
          `${entity.name}의 줄거리·캐릭터 정보는 주 1회 갱신됩니다.`,
      };
    case "performance":
      return {
        domain,
        checkedAt,
        rows: [
          { label: "공연 장소", value: "장소 확인 중" },
          { label: "공연 일정", value: "일정 확인 중" },
          { label: "공연 시간", value: "회차 공지 기준" },
          { label: "티켓 가격", value: "예매처 공지 기준" },
        ],
        chips: [{ label: "출연", items: [] }],
        synopsis:
          entityNarrativeSummary(entity) ||
          `${entity.name}의 출연·시놉시스·티켓 정보는 주 1회 갱신됩니다.`,
      };
    case "exhibition":
      return {
        domain,
        checkedAt,
        rows: [
          { label: "행사 장소", value: "장소 확인 중" },
          { label: "행사 시간", value: "운영시간 확인 중" },
          { label: "입장료", value: "요금 확인 중" },
        ],
        synopsis:
          entityNarrativeSummary(entity) ||
          `${entity.name}의 장소·시간·입장료 정보는 주 1회 갱신됩니다.`,
      };
  }
}

/**
 * Resolve curated (or fallback) entertainment facts for EntityHero.
 * Returns undefined when the entity is outside the supported menus.
 */
export function resolveEntertainmentFacts(
  entity: Pick<RankingEntity, "name" | "type" | "slug" | "tags" | "summary" | "heatmapGroup">,
): EntertainmentFacts | undefined {
  const domain = domainOf(entity);
  if (!domain) return undefined;

  const hit = lookupCatalog(entity.name, domain);
  if (hit) {
    const rows = [...hit.rows];
    if (domain === "webtoon" && !rows.some((r) => r.label === "플랫폼")) {
      const platform = inferWebtoonPlatform(entity.name, entity.tags);
      if (platform) rows.unshift({ label: "플랫폼", value: platform });
    }
    return {
      domain,
      rows,
      chips: hit.chips?.map((c) => ({ ...c, items: c.items.filter(Boolean) })),
      synopsis: hit.synopsis ?? entityNarrativeSummary(entity),
      checkedAt: hit.checkedAt ?? ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT,
    };
  }

  return fallbackFacts(entity, domain);
}

/** Heatmap chip: webtoon platform label (네이버 웹툰 등). */
export function inferWebtoonPlatformChip(
  entity: Pick<RankingEntity, "name" | "type" | "slug" | "tags" | "heatmapGroup">,
): string | undefined {
  const domain = domainOf(entity);
  if (domain !== "webtoon" && entity.type !== "webtoon") return undefined;
  const fromCatalog = lookupCatalog(entity.name, "webtoon");
  const platformRow = fromCatalog?.rows.find((r) => r.label === "플랫폼");
  if (platformRow) {
    // Prefer short badge: "네이버 웹툰" / "카카오웹툰"
    if (/네이버/.test(platformRow.value)) return "네이버 웹툰";
    if (/카카오/.test(platformRow.value)) return "카카오웹툰";
    if (/레진/.test(platformRow.value)) return "레진";
    return platformRow.value.split(/[·/]/)[0]?.trim();
  }
  return inferWebtoonPlatform(entity.name, entity.tags);
}

export function listStaleEntertainmentProfiles(now = Date.now()): string[] {
  const stale: string[] = [];
  if (entertainmentFactsAreStale(ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT, now)) {
    stale.push(`catalogue:${ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT}`);
  }
  for (const entry of CATALOG) {
    const checkedAt = entry.checkedAt ?? ENTERTAINMENT_FACTS_CATALOGUE_CHECKED_AT;
    if (entertainmentFactsAreStale(checkedAt, now)) {
      stale.push(`${entry.domain}:${entry.title}`);
    }
  }
  return stale;
}
