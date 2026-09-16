# 검색엔진 등록 · AdSense 전 체크리스트

운영 호스트는 **`https://www.kindexlab.com`** 입니다. apex(`https://kindexlab.com`)는 Vercel에서 www로 308 리다이렉트되므로 Search Console / 서치어드바이저 / sitemap 제출은 **www** 기준으로 진행하세요.

이미 준비된 것:

- `https://www.kindexlab.com/robots.txt`
- `https://www.kindexlab.com/sitemap.xml`
- 정책 페이지: `/terms`, `/disclaimer`, `/contact`, `/privacy`
- 소유권 메타: Google·네이버 확인 토큰은 `src/lib/seo-verification.ts`에 반영됨 (env로 덮어쓰기 가능)
- 상세(`/ranking`, `/politics`)는 **체인(Gemini) 분석 + 이름 품질 게이트**를 통과할 때만 `index`
- 사이트맵은 카테고리 허브·보드·브리핑·품질 통과 상세만 포함 (`/search`는 robots disallow)

로컬·프로덕션 헬스:

```bash
npm run seo:check
```

## GSC 현황 해석 (2026-09 기준)

| 지표 | 관찰 | 의미 |
|------|------|------|
| 클릭 0 / 노출 70 / 순위 11.8 | 콜드스타트 | 색인·CTR이 아직 형성되지 않음 |
| 사이트맵 성공 · 발견 1,265 | 제출은 OK | 과거엔 noindex 상세가 대량 포함 → 크롤 낭비 |
| 색인/CWV “처리 중” | 정상 | 속성 초기 며칠~수주 데이터 지연 |
| 검색어: 킨덱스, 인간극장 시청률, 기본소득당 지지율 | 기회 | 브랜드·의도 검색은 상세 색인 개방으로 흡수 |
| 총잡이 고양이 공략, 폴킴 키, 죄송하다 URL | 잡음 | 가이드/잡 URL은 색인·사이트맵에서 배제 |

## 1. Google Search Console — 지금 할 일

1. **Sitemaps**에서 `/sitemap.xml` 재제출(배포 후) → “발견된 페이지”가 품질 URL 위주로 재집계되는지 확인
2. **URL 검사 → 색인 생성 요청** (하루 소량, 허브 우선):
   - `/`
   - `/entertainment` `/politics` `/economy` `/culture` `/travel`
   - `/briefing`
   - 강한 브리핑 2~3개, 품질 통과 상세 2~3개 (예: 정당·TV 시청률 키워드)
3. **색인 생성 > 페이지** 리포트가 “처리 중”에서 벗어나면:
   - 색인됨 / 제외됨 사유를 주 1회 확인
   - “크롤됨 - 현재 색인이 생성되지 않음”, “중복”, “소프트 404” 비중을 줄이는 게 목표
4. **실적**에서 노출이 생긴 쿼리·페이지를 주 1회 점검 — CTR 0%면 제목·설명을 키워드 의도에 맞게 조정
5. 제품 스니펫(1회 노출)은 부수적 — KinDex는 지수/랭킹·NewsArticle이 본선

## 2. 네이버 서치어드바이저

1. [서치어드바이저](https://searchadvisor.naver.com/) → 사이트 `https://www.kindexlab.com`
2. HTML 메타 확인 후 `sitemap.xml` · `robots.txt` 수집
3. 주요 URL 수집 요청 (Google과 동일 허브 세트)

## 3. AdSense 전에 같이 볼 것

- 이용약관 / 면책 / 문의 / 개인정보가 실제로 열리는지 (`seo:check`에 포함)
- 홈·카테고리 보드에 빈 히트맵이 없는지
- 색인 요청은 품질 확인된 주요 URL 위주

## 코드 쪽 메모

- Google·네이버 확인 토큰: `src/lib/seo-verification.ts`
- 상세 색인 게이트: `src/lib/seo/indexable-entity.ts`
- 카테고리/상세 메타 제목은 `화제성·지지율·시청률` 등 검색 의도 키워드를 앞에 둠
