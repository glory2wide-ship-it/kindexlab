/** Rules for heatmap / ranking item display names (generation + wrap). */

/**
 * Inject into board-rank (and related) LLM system prompts so generated names
 * stay linguistically wrap-friendly on 2-line heatmap tiles.
 */
export function heatmapNameDisplayRules(): string {
  return [
    "[히트맵 종목명 표기 — 위반 시 가독성 검증 실패]",
    "1. 띄어쓰기: 의미 단위가 다른 말은 공백으로 나눈다. 예: \"소상공인 전기요금 지원\" (O), \"소상공인전기요금지원\" (X).",
    "2. 합성어 경계: 붙여 쓰는 고유·정책명도 앞머리(수혜 대상·장르)와 뒷말(상품·제도)이 드러나게 쓴다. 예: 든든전세주택, 청년도약계좌, 스포츠강좌이용권, 기후동행카드.",
    "3. 조사: 조사(은/는/이/가/을/를/의/에 …)를 단독 줄·단독 토큰으로 두지 말고 앞말에 붙인다.",
    "4. 괄호·브래킷: 장르/종류와 작품명은 구분한다. 예: \"연극〈더 헬멧〉\", \"뮤지컬 〈엘리자벳〉\". 괄호 안 문구를 중간에서 끊는 이름을 만들지 마라.",
    "5. 히트맵은 최대 2줄이다. 1행·2행이 띄어쓰기·의미·조사·괄호 경계에서 자연스럽게 나뉘도록 이름을 구성하라.",
    "6. 실패 예: 연극〈더 / 헬멧〉, 든든전 / 세주택, 청년도 / 약계좌, 스포츠강 / 좌이용권. 성공 예: 연극 / 〈더 헬멧〉, 든든 / 전세주택, 청년 / 도약계좌, 스포츠강좌 / 이용권.",
  ].join("\n");
}
