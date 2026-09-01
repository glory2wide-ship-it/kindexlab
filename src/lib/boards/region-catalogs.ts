import { REGION_HOUSING_APARTMENTS } from "@/lib/boards/housing-apartments";
import type { RegionSegment } from "@/lib/boards/types";

export const HOUSING_BOARD_SLUG = "housing-subscription-hotspot";
export const POLITICS_HOUSING_SLUG = "politics-housing-index";
export const PERFORMANCE_BOARD_SLUG = "performance-ticket-ranking";
export const EXHIBITION_BOARD_SLUG = "exhibition-popup-ranking";
export const FOOD_RESTAURANT_SLUG = "food-restaurant-ranking";
export const DOMESTIC_TRAVEL_SLUG = "domestic-travel-ranking";
export const WEEKEND_OUTING_SLUG = "weekend-outing-ranking";

/** Minimum catalog rows per 시/도 for travel heatmap regional views. */
export const TRAVEL_REGION_CATALOG_MIN = 12;

export type RegionCatalog = Record<RegionSegment, readonly string[]>;

function mergeRegionCatalog(
  base: RegionCatalog,
  extras: Partial<Record<RegionSegment, readonly string[]>>,
  min = TRAVEL_REGION_CATALOG_MIN,
): RegionCatalog {
  const regions = Object.keys(base) as RegionSegment[];
  return regions.reduce((acc, region) => {
    const merged = [...base[region]];
    for (const item of extras[region] ?? []) {
      if (merged.length >= min) break;
      if (!merged.includes(item)) merged.push(item);
    }
    acc[region] = merged.slice(0, min) as readonly string[];
    return acc;
  }, {} as RegionCatalog);
}

export const REGION_HOUSING_CATALOG: RegionCatalog = REGION_HOUSING_APARTMENTS;

export const REGION_PERFORMANCE_CATALOG: RegionCatalog = {
  seoul: ["뮤지컬 위키드", "예술의전당", "세종문화회관"],
  gyeonggi: ["경기아트센터", "성남아트센터", "고양아람누리"],
  incheon: ["인천문화예술회관", "송도 트라이보울", "부평아트센터"],
  busan: ["부산문화회관", "영화의전당", "드림씨어터"],
  daegu: ["대구오페라하우스", "수성아트피아", "대구콘서트하우스"],
  gwangju: ["국립아시아문화전당", "광주문화예술회관", "빛고을시민문화관"],
  daejeon: ["대전예술의전당", "대전시립연정국악원", "한밭야외극장"],
  ulsan: ["울산문화예술회관", "울산현대예술관", "울산북구문화예술회관"],
  sejong: ["세종예술의전당", "세종시문화관광재단", "나성동 공연"],
  gangwon: ["춘천문화예술회관", "강릉아트센터", "원주치악예술관"],
  chungbuk: ["청주예술의전당", "충북학생문화센터", "제천문화예술회관"],
  chungnam: ["천안예술의전당", "아산문화재단", "내포문화예술회관"],
  jeonbuk: ["한국소리문화의전당", "전주한벽문화관", "군산예술의전당"],
  jeonnam: ["여수시민문화회관", "순천문화건강벨트", "목포문화예술회관"],
  gyeongbuk: ["경주예술의전당", "포항문화예술회관", "구미시문화예술회관"],
  gyeongnam: ["3·15아트센터", "김해문화의전당", "진주문화예술회관"],
  jeju: ["제주아트센터", "서귀포예술의전당", "탐라문화광장"],
};

export const REGION_EXHIBITION_CATALOG: RegionCatalog = {
  seoul: ["리움미술관", "더현대서울 팝업", "성수 팝업스토어"],
  gyeonggi: ["경기도미술관", "수원광교박물관", "판교 팝업"],
  incheon: ["인천아트플랫폼", "송도트리플스트리트 팝업", "인천시립미술관"],
  busan: ["부산시립미술관", "부산비엔날레", "해운대 팝업"],
  daegu: ["대구미술관", "대구예술발전소", "동성로 팝업"],
  gwangju: ["광주비엔날레", "광주시립미술관", "국립아시아문화전당 전시"],
  daejeon: ["대전시립미술관", "이응노미술관", "둔산 팝업"],
  ulsan: ["울산시립미술관", "울산문화예술회관 전시", "태화강 전시"],
  sejong: ["세종시문화관광재단 전시", "국립세종도서관 전시", "나성 팝업"],
  gangwon: ["강릉시립미술관", "원주시립미술관", "춘천 전시"],
  chungbuk: ["청주시립미술관", "국립현대미술관 청주", "오송 팝업"],
  chungnam: ["아산시립미술관", "독립기념관 전시", "천안 팝업"],
  jeonbuk: ["전북도립미술관", "국립무형유산원 전시", "전주 팝업"],
  jeonnam: ["광양시립미술관", "여수엑스포 전시", "순천만국가정원 전시"],
  gyeongbuk: ["경주솔거미술관", "포항시립미술관", "구미 전시"],
  gyeongnam: ["경남도립미술관", "창원시립마산문신미술관", "김해 클레이아크"],
  jeju: ["제주 아르떼뮤지엄", "제주도립미술관", "서귀포 기당미술관"],
};

export const REGION_POLITICS_HOUSING_CATALOG: RegionCatalog = {
  seoul: ["강남 재건축", "토지거래허가", "분양가 상한"],
  gyeonggi: ["3기신도시", "동탄 분양", "광교 전세"],
  incheon: ["검단신도시", "송도 아파트", "청라 시세"],
  busan: ["해운대 재건축", "에코델타시티", "남구 재개발"],
  daegu: ["수성 재건축", "동구 공공주택", "범어 전세"],
  gwangju: ["광주 공공임대", "수완지구 시세", "상무 재개발"],
  daejeon: ["도안신도시", "둔산 재건축", "유성 전세"],
  ulsan: ["울산 산업단지 주택", "남구 시세", "울주 공공주택"],
  sejong: ["세종 아파트 시세", "행복도시 분양", "조치원 전세"],
  gangwon: ["춘천 혁신도시", "원주기업도시", "강릉 관광주택"],
  chungbuk: ["청주 오송", "충북혁신도시", "제천 시세"],
  chungnam: ["내포신도시", "천안 불당", "아산 탕정"],
  jeonbuk: ["전주 에코시티", "새만금 주택", "군산 시세"],
  jeonnam: ["나주혁신도시", "여수 웅천", "순천 오천"],
  gyeongbuk: ["포항 흥해", "구미 인동", "경산 중산"],
  gyeongnam: ["창원 재건축", "김해 장유", "진주 충무공동"],
  jeju: ["제주 중산간 개발", "서귀포 중문", "주택시장 안정"],
};

export const REGION_DOMESTIC_TRAVEL_CATALOG: RegionCatalog = mergeRegionCatalog(
  {
    seoul: ["경복궁", "북촌한옥마을", "인사동 골목", "한강 야경", "서울숲"],
    gyeonggi: ["가평 남이섬", "양평 두물머리", "파주 헤이리", "제부도", "수원 화성"],
    incheon: ["월미도", "강화도", "송도 센트럴파크", "차이나타운", "영종도"],
    busan: ["해운대", "광안리", "감천문화마을", "태종대", "기장 죽성리"],
    daegu: ["팔공산", "동성로", "수성못", "앞산 전망대", "대구근대골목"],
    gwangju: ["무등산", "518기념공원", "양림동", "충장로", "광주비엔날레"],
    daejeon: ["한밭수목원", "유성온천", "대청호", "엑스포과학공원", "성심당 거리"],
    ulsan: ["대왕암공원", "간절곶", "울주 대운산", "태화강", "장생포"],
    sejong: ["세종호수공원", "국립세종도서관", "조치원", "금강변", "정부세종"],
    gangwon: ["강릉 경포", "속초 설악", "평창 알펜시아", "춘천 남이섬", "양양 서피비치"],
    chungbuk: ["단양 도담삼봉", "청주 상당산성", "충주호", "속리산", "제천 의림지"],
    chungnam: ["공주 공산성", "보령 대천해수욕장", "서산 해미읍성", "태안 안면도", "천안 독립기념관"],
    jeonbuk: ["전주 한옥마을", "군산 근대역사", "내장산", "고창 선운사", "무주 덕유산"],
    jeonnam: ["여수 밤바다", "순천만", "담양 죽녹원", "목포 평화광장", "보성 녹차밭"],
    gyeongbuk: ["경주 황리단길", "안동 하회마을", "포항 호미곶", "울릉도", "구미"],
    gyeongnam: ["거제 바람의언덕", "통영 동피랑", "남해 독일마을", "진주", "창원"],
    jeju: ["서귀포", "성산일출봉", "협재해수욕장", "애월 카페거리", "한라산"],
  },
  {
    seoul: ["명동", "덕수궁", "창덕궁", "코엑스", "동대문 DDP", "홍대", "이태원"],
    gyeonggi: ["포천 아트밸리", "연천 한탄강", "용인 에버랜드", "화성 행궁", "남한산성", "의정부", "김포"],
    incheon: ["을왕리", "인천대교", "송림동", "부평시장", "옹진", "삼목", "계양"],
    busan: ["송정", "부산타워", "자갈치", "해동용궁사", "이기대", "오륙도", "국제시장"],
    daegu: ["83타워", "김광석길", "서문시장", "대구타워", "이월드", "두류공원", "비슬산"],
    gwangju: ["국립아시아문화전당", "광주호수생태원", "송정리", "전남대", "상무지구", "남구", "북구"],
    daejeon: ["뿌리공원", "계룡산", "갑천", "대전역", "중앙로", "유성구", "서구"],
    ulsan: ["울산대공원", "울산타워", "반구대", "울산항", "온산", "언양", "북구"],
    sejong: ["보람동", "아름동", "한솔동", "도담동", "연기", "전의", "금남"],
    gangwon: ["정선 레일바이크", "인제 원대리", "홍천", "삼척", "동해", "태백", "횡성"],
    chungbuk: ["옥천", "보은", "음성", "진천", "괴산", "증평", "영동"],
    chungnam: ["당진", "아산", "논산", "계룡", "홍성", "예산", "부여"],
    jeonbuk: ["익산", "정읍", "남원", "임실", "순창", "김제", "부안"],
    jeonnam: ["강진", "해남", "완도", "장흥", "고흥", "나주", "화순"],
    gyeongbuk: ["경주 불국사", "문경", "상주", "영천", "경산", "김천", "칠곡"],
    gyeongnam: ["사천", "밀양", "양산", "하동", "함안", "거창", "합천"],
    jeju: ["우도", "천지연폭포", "섭지코지", "카멜리아힐", "오설록", "중문", "표선"],
  },
);

export const REGION_WEEKEND_OUTING_CATALOG: RegionCatalog = mergeRegionCatalog(
  {
    seoul: ["한강공원", "서울숲", "북한산", "남산타워", "롯데월드", "국립중앙박물관", "청계산", "여의도한강공원"],
    gyeonggi: ["에버랜드", "광교호수공원", "일산 호수공원", "수원 화성", "파주 헤이리", "양평 두물머리", "광명동굴", "제부도"],
    incheon: ["송도 센트럴파크", "인천대공원", "월미도", "강화도", "영종도"],
    busan: ["광안리", "해운대", "태종대", "감천문화마을", "다대포"],
    daegu: ["수성못", "팔공산", "동성로", "앞산", "대구근대골목"],
    gwangju: ["무등산", "518기념공원", "충장로", "광주호수생태원", "양림동"],
    daejeon: ["한밭수목원", "대청호", "엑스포과학공원", "유성온천", "성심당"],
    ulsan: ["대왕암공원", "간절곶", "태화강", "울산대공원", "장생포"],
    sejong: ["세종호수공원", "국립세종도서관", "조치원", "금강변", "정부세종"],
    gangwon: ["남이섬", "설악산", "경포대", "평창", "양양 서피비치"],
    chungbuk: ["단양 도담삼봉", "속리산", "충주호", "청주 상당산성", "제천 의림지"],
    chungnam: ["공주 공산성", "태안 안면도", "보령 대천", "서산 해미읍성", "천안"],
    jeonbuk: ["전주 한옥마을", "내장산", "군산 근대역사", "고창", "무주"],
    jeonnam: ["담양 메타세쿼이아", "순천만", "여수", "목포", "보성"],
    gyeongbuk: ["경주", "안동 하회", "포항", "울릉도", "구미"],
    gyeongnam: ["거제", "통영", "남해", "진주", "창원"],
    jeju: ["한라산", "성산일출봉", "협재", "애월", "서귀포"],
  },
  {
    seoul: ["창경궁", "덕수궁", "올림픽공원", "노들섬"],
    gyeonggi: ["포천 아트밸리", "남한산성", "화성", "의정부"],
    incheon: ["을왕리", "차이나타운", "송림동", "부평", "삼목", "계양", "옹진"],
    busan: ["송정", "해동용궁사", "자갈치", "부산타워", "이기대", "오륙도", "국제시장"],
    daegu: ["83타워", "김광석길", "서문시장", "이월드", "두류공원", "비슬산", "대구타워"],
    gwangju: ["국립아시아문화전당", "상무지구", "전남대", "남구", "북구", "송정리", "광주역"],
    daejeon: ["뿌리공원", "계룡산", "갑천", "대전역", "중앙로", "유성구", "서구"],
    ulsan: ["울산타워", "반구대", "울산항", "온산", "언양", "북구", "울주"],
    sejong: ["보람동", "아름동", "한솔동", "도담동", "연기", "전의", "금남"],
    gangwon: ["정선", "인제", "홍천", "삼척", "동해", "태백", "횡성"],
    chungbuk: ["옥천", "보은", "음성", "진천", "괴산", "증평", "영동"],
    chungnam: ["당진", "아산", "논산", "계룡", "홍성", "예산", "부여"],
    jeonbuk: ["익산", "정읍", "남원", "임실", "순창", "김제", "부안"],
    jeonnam: ["강진", "해남", "완도", "장흥", "고흥", "나주", "화순"],
    gyeongbuk: ["불국사", "문경", "상주", "영천", "경산", "김천", "칠곡"],
    gyeongnam: ["사천", "밀양", "양산", "하동", "함안", "거창", "합천"],
    jeju: ["우도", "천지연폭포", "섭지코지", "카멜리아힐", "오설록", "중문", "표선"],
  },
);

export const REGION_FILTER_SLUGS = [
  FOOD_RESTAURANT_SLUG,
  DOMESTIC_TRAVEL_SLUG,
  WEEKEND_OUTING_SLUG,
  HOUSING_BOARD_SLUG,
  PERFORMANCE_BOARD_SLUG,
  EXHIBITION_BOARD_SLUG,
] as const;
