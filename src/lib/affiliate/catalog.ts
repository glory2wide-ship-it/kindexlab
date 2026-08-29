import type { AgeSegment, GenderSegment } from "@/lib/boards/types";
import type { PostChannel } from "@/lib/posts/types";

export interface AffiliateOffer {
  /** Search term handed to the storefront deep link. */
  query: string;
  label: string;
  /** Why this product belongs next to this ranking. */
  reason: string;
}

export interface AffiliateCategoryDefinition {
  id: string;
  heading: string;
  offers: AffiliateOffer[];
}

/**
 * Product shelves keyed by the `affiliateCategory` each board declares. These are
 * search queries rather than product ids: the storefront resolves them at click
 * time, so a delisted SKU degrades to a search page instead of a dead link.
 */
const CATEGORIES: AffiliateCategoryDefinition[] = [
  {
    id: "유튜브 장비",
    heading: "촬영·방송 장비",
    offers: [
      { query: "콘덴서 마이크", label: "콘덴서 마이크", reason: "채널 개설 시 가장 먼저 체감되는 품질 차이" },
      { query: "링라이트 조명", label: "링라이트 조명", reason: "실내 촬영 색감을 잡아주는 기본 장비" },
      { query: "웹캠 4K", label: "4K 웹캠", reason: "라이브 방송 화질 개선" },
    ],
  },
  {
    id: "트레이딩 모니터",
    heading: "트레이딩 데스크",
    offers: [
      { query: "듀얼 모니터", label: "듀얼 모니터", reason: "호가창과 차트를 동시에 보는 구성" },
      { query: "모니터 암 거치대", label: "모니터 암", reason: "장시간 시황 확인 시 목 부담 완화" },
      { query: "인체공학 사무용 의자", label: "사무용 의자", reason: "장 시간 대응을 위한 좌식 환경" },
    ],
  },
  {
    id: "투자 베스트셀러",
    heading: "투자 도서",
    offers: [
      { query: "미국주식 투자 입문서", label: "미국주식 입문서", reason: "서학개미 기초 개념 정리" },
      { query: "재테크 베스트셀러", label: "재테크 베스트셀러", reason: "자산 배분 관점 정리" },
      { query: "경제 지표 읽는 법", label: "경제 지표 해설서", reason: "지수 해석의 기준 잡기" },
    ],
  },
  {
    id: "인테리어 · 입주 가전",
    heading: "입주 준비",
    offers: [
      { query: "로봇청소기", label: "로봇청소기", reason: "입주 직후 수요가 가장 몰리는 가전" },
      { query: "시스템 조명", label: "인테리어 조명", reason: "분양 옵션 대신 직접 꾸미는 선택" },
      { query: "붙박이 수납장", label: "수납 가구", reason: "신축 단지 공간 활용" },
    ],
  },
  {
    id: "하드웨어 지갑 · 보안",
    heading: "자산 보관",
    offers: [
      { query: "하드웨어 월렛", label: "하드웨어 지갑", reason: "거래소 외부 보관용" },
      { query: "보안 USB", label: "보안 USB", reason: "시드문구 오프라인 백업" },
      { query: "블록체인 입문서", label: "블록체인 입문서", reason: "변동성의 구조 이해" },
    ],
  },
  {
    id: "생필품 핫딜",
    heading: "생활 필수품",
    offers: [
      { query: "생필품 대용량", label: "생필품 대용량", reason: "지원금 수령 시기에 묶어 구매" },
      { query: "화장지 세제 묶음", label: "세제·화장지", reason: "가격 변동이 적은 상시 소비재" },
      { query: "주방 소모품", label: "주방 소모품", reason: "월 고정 지출 절감" },
    ],
  },
  {
    id: "가성비 식료품 · 밀키트",
    heading: "식비 방어",
    offers: [
      { query: "밀키트 할인", label: "밀키트", reason: "외식비 대비 단가 비교가 쉬운 대안" },
      { query: "냉동식품 대용량", label: "냉동식품", reason: "장바구니 물가 대응" },
      { query: "쌀 10kg", label: "쌀·주식류", reason: "밥상 물가의 기준 품목" },
    ],
  },
  {
    id: "스마트TV · 사운드바",
    heading: "홈 시청 환경",
    offers: [
      { query: "스마트TV 55인치", label: "스마트TV", reason: "OTT 앱 내장 모델 기준" },
      { query: "사운드바", label: "사운드바", reason: "드라마·영화 대사 명료도 개선" },
      { query: "TV 벽걸이 브라켓", label: "벽걸이 브라켓", reason: "시청 거리 조정" },
    ],
  },
  {
    id: "삼각대 · 보조배터리",
    heading: "나들이 장비",
    offers: [
      { query: "블루투스 삼각대", label: "블루투스 삼각대", reason: "핫플레이스 인증샷용" },
      { query: "보조배터리 대용량", label: "보조배터리", reason: "종일 이동 시 배터리 방어" },
      { query: "휴대용 셀카봉", label: "셀카봉", reason: "단체 사진 확보" },
    ],
  },
  {
    id: "이북리더기 · 독서대",
    heading: "독서 환경",
    offers: [
      { query: "이북리더기", label: "이북리더기", reason: "베스트셀러 즉시 구매 후 이어읽기" },
      { query: "독서대", label: "독서대", reason: "장시간 독서 자세 유지" },
      { query: "스탠드 조명", label: "스탠드 조명", reason: "야간 독서 눈 피로 완화" },
    ],
  },
  {
    id: "오페라글라스 · 카메라",
    heading: "공연 관람",
    offers: [
      { query: "오페라글라스", label: "오페라글라스", reason: "3층 이상 좌석 시야 보완" },
      { query: "미러리스 카메라", label: "미러리스 카메라", reason: "촬영 허용 공연 기록용" },
      { query: "공연 응원봉", label: "응원 용품", reason: "응원 색 지정 공연 대비" },
    ],
  },
  {
    id: "커피머신 · 에어프라이어",
    heading: "홈 쿠킹",
    offers: [
      { query: "캡슐 커피머신", label: "커피머신", reason: "카페 단가 대비 회수 계산이 쉬움" },
      { query: "에어프라이어", label: "에어프라이어", reason: "화제 레시피 재현 빈도 최상위" },
      { query: "인덕션 냄비 세트", label: "조리도구", reason: "요리 예능 따라하기" },
    ],
  },
  {
    id: "국내 숙박 · 나들이",
    heading: "국내 여행·나들이",
    offers: [
      { query: "국내 숙박 특가", label: "국내 숙박 특가", reason: "주말·연휴 국내 여행 검색과 묶이는 숙소" },
      { query: "캠핑용품 세트", label: "캠핑용품", reason: "근교 글램핑·차박 수요" },
      { query: "휴대용 접이식 의자", label: "휴대용 의자", reason: "한강·공원 나들이 체류 시간" },
    ],
  },
  {
    id: "캐리어 · 여행용품",
    heading: "여행 준비",
    offers: [
      { query: "기내용 캐리어", label: "기내용 캐리어", reason: "단거리 노선 수하물 규정 대응" },
      { query: "여행용 어댑터", label: "멀티 어댑터", reason: "국가별 플러그 규격 차이" },
      { query: "여행 파우치 세트", label: "여행 파우치", reason: "짐 정리 시간 단축" },
    ],
  },
  {
    id: "시즌 의류 · 뷰티",
    heading: "시즌 스타일",
    offers: [
      { query: "시즌 아우터", label: "시즌 아우터", reason: "트렌드 반영 주기가 가장 빠른 품목" },
      { query: "스킨케어 세트", label: "스킨케어", reason: "환절기 루틴 교체" },
      { query: "데일리 가방", label: "데일리 가방", reason: "코디 완성도" },
    ],
  },
  {
    id: "정치 · 역사 도서",
    heading: "정치·역사 도서",
    offers: [
      { query: "정치 교양서", label: "정치 교양서", reason: "쟁점의 배경 맥락 확인" },
      { query: "한국 현대사", label: "한국 현대사", reason: "반복되는 구도의 원형 파악" },
      { query: "인문 베스트셀러", label: "인문 베스트셀러", reason: "여론 지형 이해" },
    ],
  },
  {
    id: "안마기 · 릴랙스",
    heading: "스트레스 완화",
    offers: [
      { query: "목 어깨 안마기", label: "목·어깨 안마기", reason: "뉴스 피로 해소용 수요 상위" },
      { query: "발 마사지기", label: "발 마사지기", reason: "장시간 착석 후 순환" },
      { query: "아로마 디퓨저", label: "아로마 디퓨저", reason: "휴식 환경 조성" },
    ],
  },
  {
    id: "사무용품 · 데스크테리어",
    heading: "업무 환경",
    offers: [
      { query: "문서 정리 파일", label: "문서 정리함", reason: "법안·자료 스크랩" },
      { query: "데스크 매트", label: "데스크 매트", reason: "책상 정돈" },
      { query: "고급 필기구", label: "필기구", reason: "기록 습관" },
    ],
  },
  {
    id: "블루투스 이어폰",
    heading: "청취 환경",
    offers: [
      { query: "블루투스 이어폰", label: "블루투스 이어폰", reason: "시사 방송 이동 중 청취" },
      { query: "노이즈캔슬링 헤드폰", label: "노이즈캔슬링", reason: "장시간 라디오·팟캐스트" },
      { query: "차량용 거치대", label: "차량 거치대", reason: "출퇴근 청취" },
    ],
  },
  {
    id: "경제 · 경영 서적",
    heading: "정책·경제 도서",
    offers: [
      { query: "조세 정책 도서", label: "조세 해설서", reason: "세제 개편 쟁점 이해" },
      { query: "부동산 정책 책", label: "부동산 정책서", reason: "규제 흐름 정리" },
      { query: "연금 재테크", label: "연금 실무서", reason: "개혁안 영향 계산" },
    ],
  },
  {
    id: "건강기능식품 · 영양제",
    heading: "건강 관리",
    offers: [
      { query: "종합비타민", label: "종합비타민", reason: "중장년 상시 수요" },
      { query: "오메가3", label: "오메가3", reason: "지역 커뮤니티 추천 빈도 상위" },
      { query: "루테인", label: "루테인", reason: "장시간 뉴스 시청" },
    ],
  },
  {
    id: "캠핑 · 생존 용품",
    heading: "비상 대비",
    offers: [
      { query: "비상 생존 키트", label: "비상 키트", reason: "안보 이슈 시 검색 급증 품목" },
      { query: "캠핑 랜턴", label: "캠핑 랜턴", reason: "정전 대비 겸용" },
      { query: "비상 식량", label: "비상 식량", reason: "장기 보관 식품" },
    ],
  },
  {
    id: "무선 이어폰 · 헤드폰",
    heading: "음악 감상",
    offers: [
      { query: "무선 이어폰", label: "무선 이어폰", reason: "신곡 스트리밍 음질" },
      { query: "헤드폰 하이파이", label: "하이파이 헤드폰", reason: "음원 디테일 청취" },
      { query: "앨범 보관 케이스", label: "앨범 보관", reason: "실물 앨범 수집" },
    ],
  },
  {
    id: "주식 투자 서적",
    heading: "엔터주 분석",
    offers: [
      { query: "주식 기업분석 책", label: "기업분석 입문서", reason: "기획사 실적 해석" },
      { query: "재무제표 읽는 법", label: "재무제표 해설", reason: "엔터주 변동성 판단" },
      { query: "산업 분석 리포트 책", label: "산업 분석서", reason: "콘텐츠 산업 구조" },
    ],
  },
  {
    id: "태블릿PC · 거치대",
    heading: "클립 시청",
    offers: [
      { query: "태블릿PC", label: "태블릿PC", reason: "예능 클립 몰아보기" },
      { query: "태블릿 거치대", label: "태블릿 거치대", reason: "침대·주방 시청" },
      { query: "블루투스 스피커", label: "블루투스 스피커", reason: "사운드 보강" },
    ],
  },
  {
    id: "패션 악세사리 · 향수",
    heading: "스타 아이템",
    offers: [
      { query: "니치 향수", label: "니치 향수", reason: "광고 모델 기용 브랜드 수요" },
      { query: "데일리 주얼리", label: "데일리 주얼리", reason: "화보 스타일 재현" },
      { query: "선글라스", label: "선글라스", reason: "공항 패션 아이템" },
    ],
  },
  {
    id: "게이밍 기어",
    heading: "게이밍 셋업",
    offers: [
      { query: "게이밍 마우스", label: "게이밍 마우스", reason: "e스포츠 종목 조작 정밀도" },
      { query: "기계식 키보드", label: "기계식 키보드", reason: "장시간 플레이 타건" },
      { query: "게이밍 의자", label: "게이밍 의자", reason: "PC방 대비 홈 환경" },
    ],
  },
  {
    id: "빔프로젝터 · 홈시네마",
    heading: "홈 시네마",
    offers: [
      { query: "빔프로젝터", label: "빔프로젝터", reason: "개봉작 재관람 환경" },
      { query: "팝콘 메이커", label: "팝콘 메이커", reason: "관람 경험 재현" },
      { query: "프로젝터 스크린", label: "스크린", reason: "화면비 확보" },
    ],
  },
  {
    id: "짐벌 · 링라이트",
    heading: "숏폼 제작",
    offers: [
      { query: "스마트폰 짐벌", label: "스마트폰 짐벌", reason: "챌린지 촬영 흔들림 보정" },
      { query: "링라이트", label: "링라이트", reason: "실내 숏폼 조명" },
      { query: "스마트폰 마이크", label: "스마트폰 마이크", reason: "사운드 밈 녹음" },
    ],
  },
  {
    id: "시니어 경제",
    heading: "50대 이상 경제 관심 품목",
    offers: [
      { query: "임플란트 상담", label: "임플란트", reason: "고단가 의료 검색이 몰리는 연령대" },
      { query: "골프용품 세트", label: "골프용품", reason: "여가·네트워킹 수요가 겹치는 세대" },
      { query: "건강기능식품", label: "건강기능식품", reason: "상시 재구매 주기가 짧은 카테고리" },
      { query: "탈모 샴푸", label: "탈모 샴푸", reason: "검색량이 연령과 함께 우상향하는 품목" },
    ],
  },
  {
    id: "영 우먼 라이프",
    heading: "20~30대 여성 라이프",
    offers: [
      { query: "시즌 뷰티 신상", label: "시즌 뷰티템", reason: "트렌드 주기가 가장 짧은 소비" },
      { query: "감성 인테리어 소품", label: "감성 인테리어 소품", reason: "원룸·오피스텔 꾸미기 수요" },
      { query: "해외여행 항공권", label: "여행 특가 항공권", reason: "주말·연휴 검색이 몰리는 구간" },
      { query: "국내 숙박 특가", label: "국내외 숙박 특가", reason: "항공권과 묶어 검색하는 수요" },
    ],
  },
  {
    id: "입주 프리미엄",
    heading: "이사·입주 가전",
    offers: [
      { query: "로봇청소기", label: "로봇청소기", reason: "입주 직후 검색 1위 가전" },
      { query: "이사 입주 청소", label: "이사·입주 청소", reason: "청약·잔금 시점과 맞물리는 서비스" },
      { query: "프리미엄 가전", label: "프리미엄 가전", reason: "냉장고·세탁기 교체 주기" },
    ],
  },
  {
    id: "프리미엄 모빌리티",
    heading: "수입차 유지·관리",
    offers: [
      { query: "수입차 호환 부품", label: "수입차 호환 부품", reason: "고연식 대형 세단 소모품 교체" },
      { query: "차량용 진단기 OBD", label: "차량용 진단기", reason: "에어서스펜션 경고 자가 확인" },
      { query: "프리미엄 세차 용품", label: "프리미엄 세차 용품", reason: "도장면 유지가 잔가에 영향" },
      { query: "골프용품 세트", label: "골프용품", reason: "40~50대 남성 모빌리티 소비와 겹침" },
    ],
  },
];

const BY_ID = new Map(CATEGORIES.map((item) => [item.id, item]));

/**
 * Lookup keys, most specific first. A 50대+경제 reader must not see the same
 * shelf as a 20대 여성+문화 reader.
 */
const COMBO: Record<string, string> = {
  "board:premium-mobility-value:40s": "프리미엄 모빌리티",
  "board:premium-mobility-value:50s": "프리미엄 모빌리티",
  "board:premium-mobility-value": "프리미엄 모빌리티",
  "board:performance-ticket-ranking": "오페라글라스 · 카메라",
  "board:domestic-travel-ranking": "국내 숙박 · 나들이",
  "board:overseas-travel-ranking": "캐리어 · 여행용품",
  "board:weekend-outing-ranking": "국내 숙박 · 나들이",
  "board:exhibition-popup-ranking": "삼각대 · 보조배터리",
  "board:bestseller-surge-index": "이북리더기 · 독서대",
  "board:health-info-ranking": "건강기능식품 · 영양제",
  "board:recipe-ranking": "커피머신 · 에어프라이어",
  "board:car-review-ranking": "프리미엄 모빌리티",
  "board:food-restaurant-ranking": "가성비 식료품 · 밀키트",
  "board:culture-leisure-grant-ranking": "국내 숙박 · 나들이",
  "board:housing-subscription-hotspot:30s": "입주 프리미엄",
  "board:housing-subscription-hotspot:40s": "입주 프리미엄",
  "economy:40s:male": "프리미엄 모빌리티",
  "economy:50s:male": "프리미엄 모빌리티",
  "economy:50s": "시니어 경제",
  "economy:50s:female": "시니어 경제",
  "economy:60s": "시니어 경제",
  "economy:70s": "시니어 경제",
  "economy:40s": "입주 프리미엄",
  "culture:20s:female": "영 우먼 라이프",
  "culture:30s:female": "영 우먼 라이프",
  "culture:20s": "시즌 의류 · 뷰티",
  "entertainment:20s:female": "시즌 의류 · 뷰티",
  "entertainment:10s": "짐벌 · 링라이트",
  "politics:50s": "건강기능식품 · 영양제",
  "politics:60s": "건강기능식품 · 영양제",
  "age:10s": "짐벌 · 링라이트",
  "age:20s": "시즌 의류 · 뷰티",
  "age:30s": "인테리어 · 입주 가전",
  "age:40s": "인테리어 · 입주 가전",
  "age:50s": "건강기능식품 · 영양제",
  "age:60s": "건강기능식품 · 영양제",
  "age:70s": "건강기능식품 · 영양제",
  "gender:female": "시즌 의류 · 뷰티",
};

export interface AffiliateResolveInput {
  boardCategory: string;
  channel?: PostChannel;
  boardSlug?: string;
  gender?: "all" | GenderSegment;
  age?: "all" | AgeSegment;
}

export function defaultAffiliateForChannel(channel: PostChannel): string {
  switch (channel) {
    case "economy":
      return "생필품 핫딜";
    case "culture":
      return "시즌 의류 · 뷰티";
    case "politics":
      return "정치 · 역사 도서";
    case "entertainment":
      return "무선 이어폰 · 헤드폰";
  }
}

export function resolveAffiliateCategory(
  boardCategory: string | AffiliateResolveInput,
  genderOrUnused?: "all" | GenderSegment,
  age?: "all" | AgeSegment,
): AffiliateCategoryDefinition {
  const input: AffiliateResolveInput =
    typeof boardCategory === "string"
      ? { boardCategory, gender: genderOrUnused ?? "all", age: age ?? "all" }
      : boardCategory;

  const gender = input.gender ?? "all";
  const ageKey = input.age ?? "all";
  const keys: string[] = [];
  if (input.boardSlug && ageKey !== "all") keys.push(`board:${input.boardSlug}:${ageKey}`);
  if (input.channel && ageKey !== "all" && gender !== "all") {
    keys.push(`${input.channel}:${ageKey}:${gender}`);
  }
  if (input.channel && ageKey !== "all") keys.push(`${input.channel}:${ageKey}`);
  if (input.channel && gender !== "all") keys.push(`${input.channel}:${gender}`);
  if (input.boardSlug) keys.push(`board:${input.boardSlug}`);
  if (ageKey !== "all") keys.push(`age:${ageKey}`);
  if (gender !== "all") keys.push(`gender:${gender}`);

  for (const key of keys) {
    const id = COMBO[key];
    const found = id ? BY_ID.get(id) : undefined;
    if (found) return found;
  }
  return BY_ID.get(input.boardCategory) ?? CATEGORIES[0];
}

export function listAffiliateCategories(): AffiliateCategoryDefinition[] {
  return CATEGORIES;
}
