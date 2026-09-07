export const NAVER_FINANCE_SOURCE = "네이버금융";

export function formatStockPrice(quote: { price: number; currency: "KRW" | "USD" }): string {
  if (quote.currency === "USD") {
    return `$${quote.price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${Math.round(quote.price).toLocaleString("ko-KR")}원`;
}

export function isNaverStockMeasurement(
  measurement: { source?: string; changeRate?: number; value?: number; unit?: string; label?: string } | undefined,
): measurement is {
  source: string;
  changeRate: number;
  value: number;
  unit: string;
  label: string;
} {
  return Boolean(
    measurement &&
      measurement.source === NAVER_FINANCE_SOURCE &&
      typeof measurement.value === "number" &&
      typeof measurement.changeRate === "number",
  );
}
