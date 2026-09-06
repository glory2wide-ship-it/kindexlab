import type { AffiliateProduct } from "@/lib/types";
import type { PoliticsEntityType } from "@/lib/politics/types";

export interface PoliticsCatalogEntry {
  name: string;
  nameEn: string;
  type: PoliticsEntityType;
  aliases?: string[];
  tags: string[];
  searchQuery: string;
}

function goods(name: string, query: string): AffiliateProduct[] {
  return [
    {
      id: `pol-${name}-1`,
      name: `${query} 관련 시사 도서`,
      brand: "큐레이션",
      priceKrw: 18900,
      reason: `${name} 이슈와 함께 찾는 시사·정책 자료`,
      searchQuery: query,
      category: "시사",
    },
    {
      id: `pol-${name}-2`,
      name: "정부 지원금 안내",
      brand: "큐레이션",
      priceKrw: 9900,
      reason: "정책·지원금 키워드 검색 수요",
      searchQuery: "정부 지원금",
      category: "정책",
    },
  ];
}

export const POLITICS_CATALOG: PoliticsCatalogEntry[] = [
  { name: "국회 본회의", nameEn: "National Assembly", type: "headline_news", tags: ["국회"], searchQuery: "시사 주간지" },
  { name: "대선 경선", nameEn: "Presidential primary", type: "headline_news", tags: ["대선"], searchQuery: "대선 도서" },
  { name: "공천 갈등", nameEn: "Nomination fight", type: "headline_news", tags: ["공천"], searchQuery: "정치 에세이" },
  { name: "예산안 심의", nameEn: "Budget review", type: "headline_news", tags: ["예산"], searchQuery: "경제 정책 도서" },
  { name: "연금 개혁", nameEn: "Pension reform", type: "headline_news", tags: ["연금"], searchQuery: "연금 가이드" },
  { name: "부동산 정책", nameEn: "Housing policy", type: "headline_news", tags: ["부동산"], searchQuery: "부동산 정책" },
  { name: "외교 안보", nameEn: "Diplomacy", type: "headline_news", tags: ["외교"], searchQuery: "국제정치 도서" },
  { name: "노동 입법", nameEn: "Labor bills", type: "headline_news", tags: ["노동"], searchQuery: "노동법 해설" },

  { name: "더불어민주당", nameEn: "Democratic Party", type: "party_support", aliases: ["민주당"], tags: ["여야"], searchQuery: "정치학 개론" },
  { name: "국민의힘", nameEn: "People Power Party", type: "party_support", aliases: ["국힘"], tags: ["여야"], searchQuery: "한국 정당" },
  { name: "조국혁신당", nameEn: "Rebuilding Korea Party", type: "party_support", tags: ["원내"], searchQuery: "시사 잡지" },
  { name: "개혁신당", nameEn: "Reform Party", type: "party_support", tags: ["원내"], searchQuery: "정치 에세이" },
  { name: "진보당", nameEn: "Progressive Party", type: "party_support", tags: ["원내"], searchQuery: "진보 정치" },
  { name: "기본소득당", nameEn: "Basic Income Party", type: "party_support", tags: ["원내"], searchQuery: "기본소득" },
  { name: "사회민주당", nameEn: "Social Democratic Party", type: "party_support", tags: ["원내"], searchQuery: "사회민주주의" },
  { name: "무소속", nameEn: "Independents", type: "party_support", tags: ["원내"], searchQuery: "국회 해설" },

  { name: "이재명", nameEn: "Lee Jae-myung", type: "politician_support", tags: ["대선"], searchQuery: "이재명 도서" },
  { name: "김문수", nameEn: "Kim Moon-soo", type: "politician_support", tags: ["대선"], searchQuery: "시사 도서" },
  { name: "한동훈", nameEn: "Han Dong-hoon", type: "politician_support", tags: ["여야"], searchQuery: "정치 에세이" },
  { name: "이준석", nameEn: "Lee Jun-seok", type: "politician_support", tags: ["원내"], searchQuery: "이준석 도서" },
  { name: "조국", nameEn: "Cho Kuk", type: "politician_support", tags: ["원내"], searchQuery: "조국 도서" },
  { name: "오세훈", nameEn: "Oh Se-hoon", type: "politician_support", tags: ["지자체"], searchQuery: "서울 정책" },
  { name: "김동연", nameEn: "Kim Dong-yeon", type: "politician_support", tags: ["지자체"], searchQuery: "경제 정책" },
  { name: "박찬대", nameEn: "Park Chan-dae", type: "politician_support", tags: ["원내"], searchQuery: "국회 해설" },
  { name: "배현진", nameEn: "Bae Hyun-jin", type: "politician_support", tags: ["원내"], searchQuery: "시사 도서" },
  { name: "정청래", nameEn: "Jung Chung-rae", type: "politician_support", tags: ["원내"], searchQuery: "정치 에세이" },

  { name: "유시민", nameEn: "Yoo Si-min", type: "political_pundit", tags: ["알릴레오"], searchQuery: "유시민 도서" },
  { name: "진중권", nameEn: "Jin Jung-kwon", type: "political_pundit", tags: ["시사평론가"], searchQuery: "진중권 도서" },
  { name: "전원책", nameEn: "Jeon Won-chaek", type: "political_pundit", tags: ["시사평론가"], searchQuery: "시사 토론" },
  { name: "김종배", nameEn: "Kim Jong-bae", type: "political_pundit", tags: ["시사자키"], searchQuery: "시사 라디오" },
  { name: "김근식", nameEn: "Kim Geun-sik", type: "political_pundit", tags: ["시사평론가"], searchQuery: "북한 문제" },
  { name: "황희두", nameEn: "Hwang Hee-doo", type: "political_pundit", tags: ["시사평론가"], searchQuery: "시사 토론" },
  { name: "이종훈", nameEn: "Lee Jong-hoon", type: "political_pundit", tags: ["시사평론가"], searchQuery: "시사 도서" },
  { name: "최진봉", nameEn: "Choi Jin-bong", type: "political_pundit", tags: ["시사평론가"], searchQuery: "미디어 비평" },

  { name: "김어준의 겸손은 힘들다 뉴스공장", nameEn: "Kim Eo-jun News Factory", type: "political_influencer", aliases: ["김어준의 뉴스공장", "뉴스공장", "겸손은 힘들다", "겸손은힘들다"], tags: ["유튜브", "시사", "라이브"], searchQuery: "시사 라디오" },
  { name: "김용민TV", nameEn: "Kim Yong-min TV", type: "political_influencer", tags: ["유튜브"], searchQuery: "마이크" },
  { name: "가로세로연구소", nameEn: "Garosero Research", type: "political_influencer", aliases: ["가세연"], tags: ["유튜브"], searchQuery: "웹캠" },
  { name: "신의한수", nameEn: "Shinui Hansu", type: "political_influencer", tags: ["유튜브"], searchQuery: "이어폰" },
  { name: "딴지방송국", nameEn: "Ddanzi Broadcast", type: "political_influencer", aliases: ["딴지일보", "딴지"], tags: ["유튜브"], searchQuery: "시사 잡지" },
  { name: "펜앤드마이크", nameEn: "PenN Mike", type: "political_influencer", aliases: ["펜앤마이크"], tags: ["유튜브"], searchQuery: "시사 주간지" },
  { name: "이봉규TV", nameEn: "Lee Bong-kyu TV", type: "political_influencer", tags: ["유튜브"], searchQuery: "삼각대" },
  { name: "매불쇼", nameEn: "Maebul Show", type: "political_influencer", tags: ["유튜브"], searchQuery: "무선 마이크" },
  { name: "고성국TV", nameEn: "Ko Sung-kuk TV", type: "political_influencer", tags: ["유튜브"], searchQuery: "시사 도서" },
  { name: "황희두TV", nameEn: "Hwang Hee-doo TV", type: "political_influencer", tags: ["유튜브"], searchQuery: "시사 토론" },
  { name: "열린공감TV", nameEn: "Open Empathy TV", type: "political_influencer", tags: ["유튜브"], searchQuery: "웹캠" },
  { name: "장성민의 시사탱크", nameEn: "Jang Sung-min Current Affairs Tank", type: "political_influencer", aliases: ["시사탱크"], tags: ["유튜브"], searchQuery: "시사 도서" },
  { name: "전원책TV", nameEn: "Jeon Won-chaek TV", type: "political_influencer", tags: ["유튜브"], searchQuery: "법률 서적" },
  { name: "뉴스타파", nameEn: "Newstapa", type: "political_influencer", tags: ["탐사보도"], searchQuery: "탐사보도" },
  { name: "오마이뉴스TV", nameEn: "OhmyNews TV", type: "political_influencer", tags: ["유튜브"], searchQuery: "시민기자" },
  { name: "민중의소리", nameEn: "Voice of the People", type: "political_influencer", tags: ["유튜브"], searchQuery: "시사 잡지" },
  { name: "시사타파", nameEn: "Sisa Tapa", type: "political_influencer", tags: ["유튜브"], searchQuery: "시사 도서" },
  { name: "여의도스토리", nameEn: "Yeouido Story", type: "political_influencer", tags: ["유튜브"], searchQuery: "정치 도서" },
  { name: "정치인 숏츠", nameEn: "Politician shorts", type: "political_influencer", tags: ["숏폼"], searchQuery: "숏폼 조명" },
  { name: "시사 클립", nameEn: "Current-affairs clips", type: "political_influencer", tags: ["숏폼"], searchQuery: "무선 마이크" },

  { name: "KBS 뉴스9", nameEn: "KBS News 9", type: "political_ratings", tags: ["지상파"], searchQuery: "뉴스 이어폰" },
  { name: "MBC 뉴스데스크", nameEn: "MBC Newsdesk", type: "political_ratings", tags: ["지상파"], searchQuery: "홈시네마" },
  { name: "SBS 8뉴스", nameEn: "SBS 8 News", type: "political_ratings", tags: ["지상파"], searchQuery: "TV 스탠드" },
  { name: "JTBC 뉴스룸", nameEn: "JTBC Newsroom", type: "political_ratings", tags: ["종합편성"], searchQuery: "뉴스 구독" },
  { name: "YTN", nameEn: "YTN", type: "political_ratings", tags: ["보도"], searchQuery: "라디오" },
  { name: "연합뉴스TV", nameEn: "Yonhap News TV", type: "political_ratings", tags: ["보도"], searchQuery: "뉴스 알림" },
  { name: "TV조선 뉴스", nameEn: "TV Chosun News", type: "political_ratings", tags: ["종합편성"], searchQuery: "시사 주간지" },
  { name: "채널A 뉴스", nameEn: "Channel A News", type: "political_ratings", tags: ["종합편성"], searchQuery: "시사 잡지" },

  { name: "종합부동산세", nameEn: "Comprehensive real estate tax", type: "political_search", tags: ["세금", "부동산"], searchQuery: "종부세" },
  { name: "연금개혁", nameEn: "Pension reform", type: "political_search", tags: ["복지"], searchQuery: "국민연금" },
  { name: "상속세", nameEn: "Inheritance tax", type: "political_search", tags: ["세금"], searchQuery: "상속세" },
  { name: "의대 정원", nameEn: "Medical school quota", type: "political_search", tags: ["의료"], searchQuery: "의대 증원" },
  { name: "전세제도", nameEn: "Jeonse system", type: "political_search", tags: ["주거"], searchQuery: "전세" },
  { name: "금투세", nameEn: "Financial investment tax", type: "political_search", tags: ["세금"], searchQuery: "금융투자소득세" },
  { name: "양도소득세", nameEn: "Capital gains tax", type: "political_search", tags: ["세금"], searchQuery: "양도세" },
  { name: "법인세", nameEn: "Corporate tax", type: "political_search", tags: ["세금"], searchQuery: "법인세" },
  { name: "최저임금", nameEn: "Minimum wage", type: "political_search", tags: ["노동"], searchQuery: "최저임금" },
  { name: "주 4.5일제", nameEn: "4.5-day workweek", type: "political_search", tags: ["노동"], searchQuery: "주4.5일제" },
  { name: "노란봉투법", nameEn: "Yellow Envelope Act", type: "political_search", tags: ["노동"], searchQuery: "노란봉투법" },
  { name: "검찰개혁", nameEn: "Prosecution reform", type: "political_search", tags: ["사법"], searchQuery: "검찰개혁" },
  { name: "공수처", nameEn: "CIO", type: "political_search", tags: ["사법"], searchQuery: "공수처" },
  { name: "중대재해처벌법", nameEn: "Serious Accidents Punishment Act", type: "political_search", tags: ["노동"], searchQuery: "중대재해" },
  { name: "탄소중립", nameEn: "Carbon neutrality", type: "political_search", tags: ["기후"], searchQuery: "탄소중립" },
  { name: "원전정책", nameEn: "Nuclear policy", type: "political_search", tags: ["에너지"], searchQuery: "원전" },
  { name: "기본소득", nameEn: "Basic income", type: "political_search", tags: ["복지"], searchQuery: "기본소득" },
  { name: "청년도약계좌", nameEn: "Youth leap account", type: "political_search", tags: ["청년"], searchQuery: "청년도약계좌" },
  { name: "대선", nameEn: "Presidential race", type: "political_search", tags: ["선거"], searchQuery: "대선 가이드" },
  { name: "특검", nameEn: "Special counsel", type: "political_search", tags: ["사법"], searchQuery: "특검" },

  { name: "[서울특별시] 기후동행카드", nameEn: "Climate Card", type: "local_policy", tags: ["서울"], searchQuery: "교통카드" },
  { name: "[서울특별시] 청년월세 특별지원", nameEn: "Seoul youth rent", type: "local_policy", tags: ["서울"], searchQuery: "청년월세" },
  { name: "[경기도] 청년기본소득", nameEn: "Gyeonggi youth income", type: "local_policy", tags: ["경기"], searchQuery: "청년 적금" },
  { name: "[경기도] 경기패스", nameEn: "Gyeonggi Pass", type: "local_policy", tags: ["경기"], searchQuery: "경기패스" },
  { name: "[경기도 수원시] 새빛돌봄", nameEn: "Saebit care", type: "local_policy", tags: ["수원"], searchQuery: "새빛돌봄" },
  { name: "[전라남도] 100원 택시", nameEn: "100-won taxi", type: "local_policy", tags: ["전남"], searchQuery: "100원 택시" },
  { name: "[부산광역시] 동백전", nameEn: "Dongbaekjeon", type: "local_policy", tags: ["부산"], searchQuery: "동백전" },
  { name: "[인천광역시] 인천e음", nameEn: "Incheon e-eum", type: "local_policy", tags: ["인천"], searchQuery: "인천e음" },
  { name: "[대구광역시] 대구행복페이", nameEn: "Daegu Happy Pay", type: "local_policy", tags: ["대구"], searchQuery: "대구행복페이" },
  { name: "[광주광역시] 광주상생카드", nameEn: "Gwangju card", type: "local_policy", tags: ["광주"], searchQuery: "광주상생카드" },
  { name: "[대전광역시] 대전사랑카드", nameEn: "Daejeon love card", type: "local_policy", tags: ["대전"], searchQuery: "대전사랑카드" },
  { name: "[제주특별자치도] 관광정책", nameEn: "Jeju tourism", type: "local_policy", tags: ["제주"], searchQuery: "제주 여행" },

  { name: "[고용노동부] 국민취업지원제도", nameEn: "National employment support", type: "subsidy", tags: ["고용"], searchQuery: "취업 준비" },
  { name: "[금융위원회] 청년도약계좌", nameEn: "Youth leap account", type: "subsidy", tags: ["청년"], searchQuery: "청년도약계좌" },
  { name: "[국토교통부] 디딤돌대출", nameEn: "Didimdol loan", type: "subsidy", tags: ["주거"], searchQuery: "디딤돌대출" },
  { name: "[산업통상자원부] 에너지바우처", nameEn: "Energy voucher", type: "subsidy", tags: ["에너지"], searchQuery: "에너지바우처" },
  { name: "[보건복지부] 부모급여", nameEn: "Parental benefit", type: "subsidy", tags: ["보육"], searchQuery: "부모급여" },
  { name: "[보건복지부] 기초연금", nameEn: "Basic pension", type: "subsidy", tags: ["복지"], searchQuery: "기초연금" },
  { name: "[국세청] 근로장려금", nameEn: "EITC", type: "subsidy", tags: ["세정"], searchQuery: "근로장려금" },
  { name: "[국세청] 자녀장려금", nameEn: "Child tax credit", type: "subsidy", tags: ["세정"], searchQuery: "자녀장려금" },
  { name: "[보건복지부] 청년내일저축계좌", nameEn: "Youth tomorrow savings", type: "subsidy", tags: ["청년"], searchQuery: "청년내일저축계좌" },
  { name: "[주택도시보증공사] 전세보증금 반환보증", nameEn: "Jeonse deposit guarantee", type: "subsidy", tags: ["주거"], searchQuery: "전세보증금" },
  { name: "[중소벤처기업부] 소상공인 전기요금 지원", nameEn: "SME electricity support", type: "subsidy", tags: ["소상공인"], searchQuery: "소상공인 전기요금" },
];

export function politicsProducts(entry: PoliticsCatalogEntry): AffiliateProduct[] {
  return goods(entry.name, entry.searchQuery);
}

export function catalogByType(type: PoliticsEntityType): PoliticsCatalogEntry[] {
  return POLITICS_CATALOG.filter((item) => item.type === type);
}

export function matchPoliticsCatalog(text: string): PoliticsCatalogEntry[] {
  const hay = text.replace(/\s+/g, "");
  return POLITICS_CATALOG.filter((item) => {
    const names = [item.name, item.nameEn, ...(item.aliases ?? [])];
    return names.some((name) => name && (hay.includes(name.replace(/\s+/g, "")) || text.includes(name)));
  });
}
