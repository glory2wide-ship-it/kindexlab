/**
 * Display-name → Naver marketindex (FX / energy / metals / agricultural).
 * Theme keywords without a tradable series are omitted.
 */

export type MarketIndexCategory = "exchange" | "energy" | "metals" | "agricultural";

export interface MarketIndexSymbol {
  category: MarketIndexCategory;
  /** reutersCode path segment, e.g. FX_USDKRW, CLcv1 */
  code: string;
}

const BY_NAME: Record<string, MarketIndexSymbol> = {
  // FX
  원달러: { category: "exchange", code: "FX_USDKRW" },
  "원·달러": { category: "exchange", code: "FX_USDKRW" },
  달러: { category: "exchange", code: "FX_USDKRW" },
  USD: { category: "exchange", code: "FX_USDKRW" },
  엔화: { category: "exchange", code: "FX_JPYKRW" },
  엔: { category: "exchange", code: "FX_JPYKRW" },
  JPY: { category: "exchange", code: "FX_JPYKRW" },
  유로: { category: "exchange", code: "FX_EURKRW" },
  EUR: { category: "exchange", code: "FX_EURKRW" },
  위안화: { category: "exchange", code: "FX_CNYKRW" },
  위안: { category: "exchange", code: "FX_CNYKRW" },
  CNY: { category: "exchange", code: "FX_CNYKRW" },
  달러인덱스: { category: "exchange", code: ".DXY" },
  DXY: { category: "exchange", code: ".DXY" },

  // Energy
  WTI: { category: "energy", code: "CLcv1" },
  "WTI 유가": { category: "energy", code: "CLcv1" },
  서부텍사스유: { category: "energy", code: "CLcv1" },
  브렌트유: { category: "energy", code: "LCOcv1" },
  브렌트: { category: "energy", code: "LCOcv1" },
  두바이유: { category: "energy", code: "DCBc1" },
  천연가스: { category: "energy", code: "NGcv1" },
  LNG: { category: "energy", code: "NGcv1" },
  난방유: { category: "energy", code: "HOcv1" },
  가솔린: { category: "energy", code: "RBcv1" },

  // Metals
  금: { category: "metals", code: "GCcv1" },
  금값: { category: "metals", code: "GCcv1" },
  "국제 금": { category: "metals", code: "GCcv1" },
  국제금: { category: "metals", code: "GCcv1" },
  "국내 금": { category: "metals", code: "M04020000" },
  국내금: { category: "metals", code: "M04020000" },
  은: { category: "metals", code: "SIcv1" },
  구리: { category: "metals", code: "HGcv1" },
  "구리(선물)": { category: "metals", code: "HGcv1" },
  "구리(현물)": { category: "metals", code: "CMCU0" },
  백금: { category: "metals", code: "PLcv1" },

  // Agricultural
  옥수수: { category: "agricultural", code: "Ccv1" },
  대두: { category: "agricultural", code: "Scv1" },
  콩: { category: "agricultural", code: "Scv1" },
  밀: { category: "agricultural", code: "Wcv1" },
  커피: { category: "agricultural", code: "KCcv1" },
  "커피 원두": { category: "agricultural", code: "KCcv1" },
  원두: { category: "agricultural", code: "KCcv1" },
  설탕: { category: "agricultural", code: "SBcv1" },
};

export function normalizeMarketIndexName(name: string): string {
  return name
    .trim()
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\s+/g, " ");
}

export function marketIndexSymbolForName(name: string): MarketIndexSymbol | undefined {
  const raw = name.trim();
  if (!raw) return undefined;
  const spaced = normalizeMarketIndexName(raw);
  const compact = spaced.replace(/\s+/g, "");
  return (
    BY_NAME[raw] ??
    BY_NAME[spaced] ??
    BY_NAME[compact] ??
    BY_NAME[raw.replace(/\s+/g, "")]
  );
}

export const COMMODITIES_FX_BOARD_SLUG = "commodities-fx-index";
