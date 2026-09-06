/** Entertainment-category 정부 지원금 board (mirrors politics/economy subsidy shape). */
export const ENT_GRANT_SLUG = "entertainment-government-grant-ranking";
export const ENT_GRANT_TITLE = "정부 지원금";

export function isEntertainmentGrantBoard(slug?: string): boolean {
  return slug === ENT_GRANT_SLUG;
}
