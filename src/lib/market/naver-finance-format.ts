export const NAVER_FINANCE_SOURCE = "네이버금융";

export function formatStockPrice(quote: { price: number; currency: "KRW" | "USD" }): string {
  if (quote.currency === "USD") {
    return `$${quote.price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (Number.isInteger(quote.price)) {
    return `${Math.round(quote.price).toLocaleString("ko-KR")}원`;
  }
  return `${quote.price.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}원`;
}

/** Format any Naver finance measurement for heatmap / detail tiles. */
export function formatNaverMeasurement(measurement: {
  value: number;
  unit: string;
}): string {
  const unit = measurement.unit.trim();
  const price = measurement.value;

  if (unit === "KRW" || unit === "원") {
    return formatStockPrice({
      price,
      currency: "KRW",
    });
  }

  if (unit === "원/g") {
    return `${Math.round(price).toLocaleString("ko-KR")}원/g`;
  }

  if (unit === "USD") {
    return formatStockPrice({ price, currency: "USD" });
  }

  if (unit.startsWith("USD")) {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: price >= 100 ? 2 : 4,
    })}`;
  }

  if (unit.startsWith("USc")) {
    return `${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}¢`;
  }

  return `${price.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${unit}`.trim();
}

export function isNaverStockMeasurement(
  measurement: {
    source?: string;
    changeRate?: number;
    value?: number;
    unit?: string;
    label?: string;
    observedAt?: string;
  } | undefined,
): measurement is {
  source: string;
  changeRate: number;
  value: number;
  unit: string;
  label: string;
  observedAt?: string;
} {
  return Boolean(
    measurement &&
      measurement.source === NAVER_FINANCE_SOURCE &&
      typeof measurement.value === "number" &&
      typeof measurement.changeRate === "number",
  );
}
