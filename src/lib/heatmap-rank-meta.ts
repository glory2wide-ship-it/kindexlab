/**
 * Paint-only rank-prefix metadata for heatmap tiles.
 * Infers TV channel / music genre / celebrity job / book genre from name + tags.
 */

import { isLikelyTrotArtist, isLikelyKpopIdol } from "@/lib/boards/trot";
import { getBoard } from "@/lib/boards/registry";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import type { RankingEntity } from "@/lib/types";

type MetaEntity = Pick<RankingEntity, "name" | "nameEn" | "type" | "slug" | "heatmapGroup" | "tags">;

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function subjectName(name: string): string {
  return compact(name.replace(/^\[[^\]]+\]\s*/, "").replace(/\s*\([^)]*\)\s*/g, " "));
}

/** Strip `[` `]` only — keep the qualifier text for chips. */
export function stripChipBrackets(label: string): string {
  return compact(label.replace(/[\[\]]/g, ""));
}

const TV_CHANNEL_ALIASES: Record<string, string> = {
  kbs: "KBS",
  kbs1: "KBS",
  kbs2: "KBS",
  mbc: "MBC",
  sbs: "SBS",
  jtbc: "JTBC",
  tvn: "tvN",
  "tv n": "tvN",
  tv조선: "TV조선",
  조선tv: "TV조선",
  채널a: "채널A",
  channela: "채널A",
  mbn: "MBN",
  ena: "ENA",
  ocn: "OCN",
  mnet: "Mnet",
  ebs: "EBS",
  ytn: "YTN",
  "연합뉴스tv": "YTN",
  "mbc every1": "MBC",
  "sbs plus": "SBS",
  "kbs drama": "KBS",
  "mbc dramnet": "MBC",
  tvch: "TV조선",
};

/** Popular programme → broadcast channel. */
const TV_SHOW_CHANNEL: Record<string, string> = {
  "나 혼자 산다": "MBC",
  "미운 우리 새끼": "SBS",
  런닝맨: "SBS",
  "유 퀴즈 온 더 블럭": "tvN",
  "진격의 할매": "MBC",
  "나는 솔로": "SBS",
  하트시그널: "채널A",
  "선재 업고 튀어": "tvN",
  "눈물의 여왕": "tvN",
  "여보 미안해": "KBS",
  핑계고: "유튜브",
  전국노래자랑: "KBS",
  열린음악회: "KBS",
  "불후의 명곡": "KBS",
  "1박 2일": "KBS",
  신랑수업: "TV조선",
  동상이몽: "SBS",
  "오은영 리포트": "MBC",
  뉴스a: "채널A",
  "뉴스A": "채널A",
  "jtbc 뉴스룸": "JTBC",
  "JTBC 뉴스룸": "JTBC",
  "tv조선 뉴스": "TV조선",
  "그것이 알고싶다": "SBS",
  스우파: "Mnet",
  "kbs 뉴스9": "KBS",
  "KBS 뉴스9": "KBS",
  "mbc 뉴스데스크": "MBC",
  "MBC 뉴스데스크": "MBC",
  "sbs 8뉴스": "SBS",
  "SBS 8뉴스": "SBS",
  무한도전: "MBC",
  라디오스타: "MBC",
  "냉장고를 부탁해": "JTBC",
  비긴어게인: "JTBC",
  아는형님: "JTBC",
  골때리는그녀들: "SBS",
  미스터트롯: "TV조선",
  미스트롯: "TV조선",
  "환승연애": "TV조선",
  "솔로지옥": "ENA",
  "폭싹 속았수다": "Netflix",
};

function normalizeTvChannel(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = compact(raw).replace(/[\[\]]/g, "");
  if (!cleaned || cleaned.length > 18) return undefined;
  const key = cleaned.toLowerCase().replace(/\s+/g, " ");
  if (TV_CHANNEL_ALIASES[key]) return TV_CHANNEL_ALIASES[key];
  if (TV_CHANNEL_ALIASES[key.replace(/\s/g, "")]) return TV_CHANNEL_ALIASES[key.replace(/\s/g, "")];
  // Leading network token in "KBS2 저녁" etc.
  const lead = cleaned.match(
    /^(KBS2?|MBC|SBS|JTBC|tvN|TVN|TV조선|채널A|MBN|ENA|OCN|Mnet|EBS|YTN)\b/i,
  );
  if (lead?.[1]) return normalizeTvChannel(lead[1]);
  if (/^(KBS|MBC|SBS|JTBC|tvN|TV조선|채널A|MBN|ENA|OCN|Mnet|EBS|YTN)$/i.test(cleaned)) {
    return cleaned.replace(/^tvn$/i, "tvN").replace(/^TVN$/, "tvN");
  }
  return undefined;
}

export function inferTvChannelChip(entity: MetaEntity): string | undefined {
  const tags = entity.tags ?? [];
  for (const tag of tags) {
    const hit = normalizeTvChannel(tag);
    if (hit) return hit;
  }
  const fromEn = normalizeTvChannel(entity.nameEn);
  if (fromEn) return fromEn;

  const name = subjectName(entity.name);
  const fromName = normalizeTvChannel(name);
  if (fromName) return fromName;

  for (const [show, channel] of Object.entries(TV_SHOW_CHANNEL)) {
    if (namesOverlap(show, name) || normalizeName(name).includes(normalizeName(show))) {
      return channel;
    }
  }
  return undefined;
}

const IDOL_ARTISTS = () => getBoard("kpop-fandom-power")?.seeds ?? [];

function musicArtistHint(entity: MetaEntity): string {
  const name = subjectName(entity.name);
  // "APT. 로제" / "Love wins all 아이유"
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1] ?? "";
    if (/^[A-Za-z가-힣().]{1,20}$/.test(tail) && !/^(feat\.?|ft\.?|with)$/i.test(tail)) {
      return tail;
    }
  }
  if (entity.nameEn && entity.nameEn !== name && entity.nameEn.length <= 24) {
    return entity.nameEn;
  }
  return name;
}

export function inferMusicGenreChip(entity: MetaEntity): string | undefined {
  const blob = `${entity.name} ${(entity.tags ?? []).join(" ")} ${entity.nameEn ?? ""}`;
  if (/트로트|미스터트롯|성인가요|7080/.test(blob) || isLikelyTrotArtist(musicArtistHint(entity))) {
    return "트로트";
  }
  if (/힙합|랩\b|hip-?hop|래퍼/i.test(blob)) return "힙합";
  if (/R&?B|알앤비|소울/i.test(blob)) return "R&B";
  if (/OST|사운드트랙|드라마\s*OST|영화\s*OST/i.test(blob)) return "OST";
  if (/인디|포크|어쿠스틱/i.test(blob)) return "인디";
  if (/발라드|ballad|감성\s*발라드/i.test(blob)) return "발라드";
  if (/록|락\b|밴드|rock/i.test(blob)) return "록";
  if (/재즈|jazz/i.test(blob)) return "재즈";
  if (/클래식|오케스트라/i.test(blob)) return "클래식";
  if (/댄스|edm|일렉/i.test(blob)) return "댄스";

  const artist = musicArtistHint(entity);
  if (isLikelyKpopIdol(artist) || IDOL_ARTISTS().some((seed) => namesOverlap(seed, artist))) {
    return "댄스";
  }
  if (/린$|성시경|박효신|김동률|이문세|아이유|태연|백예린|폴킴|멜로망스/.test(artist)) {
    return "발라드";
  }
  if (/지코|사이먼|빈지노|창모|키드밀리|애쉬|릴러말즈|스윙스/.test(artist)) return "힙합";
  // Default chart pop
  return "댄스";
}

const CELEBRITY_JOBS: Record<string, string> = {
  // 아이돌·가수
  장원영: "가수",
  카리나: "가수",
  안유진: "가수",
  해린: "가수",
  윈터: "가수",
  아이유: "가수",
  수지: "가수",
  임영웅: "가수",
  영탁: "가수",
  이찬원: "가수",
  김호중: "가수",
  송가인: "가수",
  // 배우
  김지원: "배우",
  노윤서: "배우",
  문가영: "배우",
  고윤정: "배우",
  변우석: "배우",
  채종협: "배우",
  이재욱: "배우",
  손석구: "배우",
  김고은: "배우",
  한소희: "배우",
  마동석: "배우",
  박보검: "배우",
  현빈: "배우",
  손예진: "배우",
  공유: "배우",
  전지현: "배우",
  이정재: "배우",
  김수현: "배우",
  송중기: "배우",
  김태리: "배우",
  박서준: "배우",
  한지민: "배우",
  전도연: "배우",
  이병헌: "배우",
  송혜교: "배우",
  // 예능인
  유재석: "예능인",
  강호동: "예능인",
  신동엽: "예능인",
  전현무: "예능인",
  이영자: "예능인",
  박나래: "예능인",
  김숙: "예능인",
  양세형: "예능인",
  조세호: "예능인",
  이광수: "예능인",
  지석진: "예능인",
  하하: "예능인",
  송은이: "예능인",
  김신영: "예능인",
};

export function inferCelebrityJobChip(entity: MetaEntity): string | undefined {
  const tags = entity.tags ?? [];
  for (const tag of tags) {
    if (/^(배우|가수|예능인|아이돌|코미디언|모델|개그맨|MC)$/.test(tag)) {
      return tag === "아이돌" ? "가수" : tag === "코미디언" || tag === "개그맨" || tag === "MC" ? "예능인" : tag;
    }
  }
  const name = subjectName(entity.name);
  for (const [person, job] of Object.entries(CELEBRITY_JOBS)) {
    if (namesOverlap(person, name) || normalizeName(name) === normalizeName(person)) return job;
  }
  if (isLikelyTrotArtist(name) || isLikelyKpopIdol(name)) return "가수";
  // Hangul given-name celebrities on drama boards skew actor; keep a safe default.
  if (/배우|연기|드라마|영화/.test(tags.join(" "))) return "배우";
  if (/예능|개그|코미디|MC/.test(tags.join(" "))) return "예능인";
  return "배우";
}

const BOOK_TITLE_GENRE: Record<string, string> = {
  "마흔에 읽는 쇼펜하우어": "인문",
  "세이노의 가르침": "자기계발",
  역행자: "자기계발",
  "도둑맞은 집중력": "인문",
  "트렌드 코리아": "경제",
  "불편한 편의점": "소설",
  채식주의자: "소설",
  "작별하지 않는다": "소설",
  사피엔스: "인문",
  코스모스: "과학",
  "미움받을 용기": "자기계발",
  "데일 카네기": "자기계발",
  어린왕자: "소설",
  데미안: "소설",
  "자존감 수업": "자기계발",
  "달러구트 꿈 백화점": "소설",
  "부의 추월차선": "경제",
  "돈의 심리학": "경제",
  "1984": "소설",
  총균쇠: "인문",
  원피스: "만화",
  해리포터: "소설",
  "조선의 오후": "소설",
  "오만과 편견": "소설",
  "나미야 잡화점": "소설",
};

export function inferBookGenreChip(entity: MetaEntity): string | undefined {
  const tags = entity.tags ?? [];
  for (const tag of tags) {
    if (/^(소설|수필|에세이|교육|매거진|잡지|자기계발|인문|경제|경영|과학|만화|아동|시|역사)$/.test(tag)) {
      if (tag === "에세이") return "수필";
      if (tag === "잡지") return "매거진";
      if (tag === "경영") return "경제";
      return tag;
    }
  }
  const name = subjectName(entity.name);
  for (const [title, genre] of Object.entries(BOOK_TITLE_GENRE)) {
    if (namesOverlap(title, name) || normalizeName(name).includes(normalizeName(title))) {
      return genre;
    }
  }
  const blob = `${name} ${tags.join(" ")}`;
  if (/매거진|잡지|월간|주간/.test(blob)) return "매거진";
  if (/수필|에세이|산문/.test(blob)) return "수필";
  if (/교육|교과서|수능|학습|문제집|자격증/.test(blob)) return "교육";
  if (/만화|웹툰|코믹스|원피스|진격/.test(blob)) return "만화";
  if (/경제|투자|부자|재테크|주식|돈의/.test(blob)) return "경제";
  if (/과학|우주|물리|생물|코스모스/.test(blob)) return "과학";
  if (/자기계발|습관|성공|용기|자존감|가르침|역행/.test(blob)) return "자기계발";
  if (/인문|철학|역사|사피엔스|쇼펜하우어/.test(blob)) return "인문";
  if (/소설|이야기|편의점|왕자|데미안|해리|편견/.test(blob)) return "소설";
  return "소설";
}

export function boardSlugOf(entity: Pick<RankingEntity, "slug">): string {
  const slug = entity.slug ?? "";
  return slug.includes("--") ? slug.split("--")[0]! : slug;
}
