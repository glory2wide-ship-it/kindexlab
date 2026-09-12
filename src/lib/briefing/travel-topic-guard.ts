import { INDUSTRIAL_ECONOMY_LEAK } from "@/lib/boards/sense";

const TRAVEL_ON_SENSE =
  /여행|관광|나들이|맛집|숙소|항공|명소|휴양|코스|가볼만한|축제|해수욕장|트레킹|핫플|주말\s*나들이|여행지|관광지/;

/**
 * True when copy is industrial/investment economy and lacks travel framing.
 * Used for travel channel mains that may not resolve a board unit sense.
 */
export function isIndustrialEconomyTravelMismatch(plainText: string): boolean {
  const text = plainText.replace(/\s+/g, " ");
  if (!INDUSTRIAL_ECONOMY_LEAK.test(text)) return false;
  const travelHits = text.match(new RegExp(TRAVEL_ON_SENSE.source, "g"))?.length ?? 0;
  return travelHits < 2;
}
