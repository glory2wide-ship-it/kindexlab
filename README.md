# KindexLab

디엘파크주식회사가 운영하는 K-컬처 화제 지수(INDEX)입니다. 도메인: [kindexlab.com](https://kindexlab.com). Finviz 스타일 트리맵과 리스트로 버즈·음원·시청률·웹툰·숏폼·게임을 보여 주며, Google AdSense 자동 광고와 쿠팡 파트너스 연동을 전제로 합니다.

문의: glory2wide@gmail.com

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

로컬에서는 `.env.local`의 `NEXT_PUBLIC_SITE_URL`을 `http://localhost:3000`으로 두면 됩니다. 배포 기본값은 `https://kindexlab.com`입니다.

## 스택

- Next.js App Router + TypeScript
- Tailwind CSS v4
- d3-hierarchy (트리맵)
- Vercel 배포 (`npm run build`)

## 화면

| 경로 | 역할 |
| --- | --- |
| `/` | 히트맵/리스트 지수(INDEX), 타임프레임(1m~120m, Daily, Weekly, Monthly), 오늘의 브리핑 레일 |
| `/ranking/[slug]` | 분봉·일·주·월 차트, 쿠팡 상품 |
| `/briefing` | 오늘 발행분 허브(종합 1 + 히트맵 카테고리 심층) |
| `/briefing/[slug]` | 1,000단어+ H2/H3 브리핑 본문 |
| `/briefing/archive` | 어제 이전 에디션 검색·카테고리 필터 |
| `/about` | 데이터 구성·시세 산출 방식 |
| `/privacy` | 개인정보처리방침 |
| `/terms` | 이용약관 |
| `/disclaimer` | 면책조항 |
| `/contact` | 문의하기 |
| `/api/rankings` | 랭킹 JSON |
| `/api/cron/briefings` | 일일 브리핑 생성 잡(CRON_SECRET) |

지수(INDEX) 필터: 종합, K-POP 아이돌, 셀럽, 방송, 인플루언서, 실시간 음원 차트, 실시간 시청률 순위, 실시간 웹툰, 숏폼/SNS, 모바일·PC·콘솔 게임. 박스 크기는 거래량, 색상은 선택 타임프레임의 등락률입니다. 카테고리 딥링크는 `/?category=kpop#heatmap` 형식입니다.

## 일일 브리핑 자동화

매일 KST 07:00(`0 22 * * *` UTC)에 종합 1편 + 히트맵 전 카테고리 심층(급등·급락 분석, H2/H3, 1,000단어 이상)을 생성합니다. 본문은 랭킹 스냅샷을 넣는 결정론적 작성기를 기본으로 하고, `OPENAI_API_KEY`가 있으면 OpenAI로 윤문한 뒤 1,000단어 미만이면 작성기로 되돌립니다. 날짜가 바뀌면 전날 기사는 `/briefing/archive`에서 검색됩니다.

```bash
npm run briefing:generate
npm run briefing:generate -- --force 2026-08-25
```

성공 시 `src/data/briefings/extra.json`에 병합됩니다. Vercel 서버리스 파일시스템은 유지되지 않으므로, 장기 SEO 아카이브는 GitHub Actions(`.github/workflows/daily-briefings.yml`)로 커밋하거나 같은 명령을 CI에서 돌리면 됩니다. 런타임에 오늘 날짜 에디션이 시드에 없으면 요청 시 생성해 1시간 캐시합니다.

Vercel Cron은 `CRON_SECRET`을 설정한 뒤 `GET/POST /api/cron/briefings`를 호출합니다. 이미 같은 날짜 슬러그가 있으면 건너뜁니다(`?force=1`로 재생성).

## 실제 데이터 연결

`src/lib/api.ts`의 `getRankings()`만 교체하면 됩니다. 분봉 시리즈는 `src/lib/timeframes.ts`에서 생성하므로, 실데이터 연결 시 같은 `SeriesPoint[]`로 바꾸면 됩니다.
