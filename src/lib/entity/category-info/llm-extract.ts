/**
 * Gated LLM field extraction for 맞춤 정보 catalogue misses.
 * Only fills still-UPDATING required labels; validators must accept values.
 */
import { analysisLlmConfigured, chatJsonLive } from "@/lib/analysis/chain/llm";
import { analysisLogger } from "@/lib/analysis/log";
import type { CategoryInfoChannel, CategoryInfoRow } from "@/lib/entity/category-info/types";
import { isUpdatingValue } from "@/lib/entity/category-info/trust";

type ExtractResult = {
  rows?: Array<{ label: string; value: string }>;
};

const LABEL_HINTS: Partial<Record<CategoryInfoChannel, string>> = {
  kpop: "소속사, 데뷔, 최근 히트곡(곡명만)",
  trot: "소속사, 데뷔, 최근 히트곡(곡명만)",
  star: "소속사, 최근 작품, 최근 히트곡",
  movie: "감독, 개봉, 출연",
  webtoon: "플랫폼, 작가, 주요 인물",
  book: "작가, 출판사, 장르",
  performance: "공연 장소, 공연 일정, 티켓 가격",
  exhibition: "행사 장소, 행사 시간, 입장료",
  food: "주소, 영업시간, 추천 메뉴",
  gov_subsidy: "주관 기관, 신청 기간, 신청 자격·조건",
  travel_grant: "주관 기관, 신청 기간, 신청 자격·조건",
  youtuber: "유튜브 채널, 구독자 수",
};

function looksLikeJunk(label: string, value: string): boolean {
  const v = value.trim();
  if (v.length < 2 || v.length > 160) return true;
  if (isUpdatingValue(v)) return true;
  if (/https?:\/\/|www\./i.test(v) && !/채널|URL|홈페이지|기관/.test(label)) return true;
  if (/모름|알\s*수\s*없|확인\s*불|N\/?A|없음|미상/i.test(v)) return true;
  if (/히트곡|곡/.test(label) && /소속|데뷔|감독|작가/.test(v)) return true;
  if (/가격|입장료|티켓/.test(label) && !/\d/.test(v)) return true;
  if (/기간|일정|개봉|데뷔/.test(label) && !/\d/.test(v)) return true;
  return false;
}

/**
 * Fill remaining UPDATING required rows via a single Gemini JSON call.
 * Returns only validated label/value pairs.
 */
export async function extractMissingCategoryFields(options: {
  entityName: string;
  channel: CategoryInfoChannel;
  missingLabels: string[];
  corpus?: string;
}): Promise<CategoryInfoRow[]> {
  if (!analysisLlmConfigured()) return [];
  if (!options.missingLabels.length) return [];
  if (process.env.CATEGORY_INFO_LLM_EXTRACT === "0") return [];

  const hints = LABEL_HINTS[options.channel] ?? options.missingLabels.join(", ");
  const logger = analysisLogger(`category-info:${options.entityName}`);
  const corpus = (options.corpus ?? "").slice(0, 3500);

  const result = await chatJsonLive<ExtractResult>({
    step: "category-info-field-extract",
    logger,
    temperature: 0.1,
    maxTokens: 1024,
    timeoutMs: 25_000,
    system: [
      "당신은 한국 엔터·문화·복지 종목 상세 팩트 추출기입니다.",
      "모르는 값은 절대 추측하지 말고 해당 label을 생략하세요.",
      "JSON만 반환: {\"rows\":[{\"label\":\"...\",\"value\":\"...\"}]}",
      "value는 한국어 짧은 사실 문장/고유명사. URL·광고·의견 금지.",
    ].join("\n"),
    user: [
      `종목: ${options.entityName}`,
      `채널: ${options.channel}`,
      `채워야 할 항목: ${options.missingLabels.join(", ")}`,
      `참고 힌트: ${hints}`,
      corpus ? `참고 문서:\n${corpus}` : "참고 문서 없음 — 확신이 있을 때만 채우세요.",
    ].join("\n\n"),
    jsonSchema: {
      name: "category_info_rows",
      strict: true,
      schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" },
              },
              required: ["label", "value"],
              additionalProperties: false,
            },
          },
        },
        required: ["rows"],
        additionalProperties: false,
      },
    },
  });

  if (!result?.rows?.length) return [];

  const allowed = new Set(options.missingLabels);
  const out: CategoryInfoRow[] = [];
  for (const row of result.rows) {
    const label = row.label?.trim();
    const value = row.value?.trim();
    if (!label || !value) continue;
    if (![...allowed].some((want) => label === want || label.includes(want) || want.includes(label))) {
      continue;
    }
    if (looksLikeJunk(label, value)) continue;
    out.push({ label, value });
  }
  return out;
}
