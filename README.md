# KindexLab

디엘파크주식회사가 운영하는 K-컬처 화제 지수(INDEX)입니다. 도메인: [kindexlab.com](https://kindexlab.com). Finviz 스타일 트리맵과 리스트로 버즈·음원·시청률·웹툰·숏폼·게임을 보여 주며, Google AdSense 자동 광고와 쿠팡 파트너스 연동을 전제로 합니다.

문의: glory2wide@gmail.com

## 실행

GitHub 저장소: [glory2wide-ship-it/kindexlab](https://github.com/glory2wide-ship-it/kindexlab)

```bash
npm ci
./scripts/ensure-local-env.sh
npm run dev
```

기본 개발 서버는 `http://localhost:3000`입니다. Cursor Cloud Agent에서는 `npm run dev:cloud`로 `http://127.0.0.1:43123`에 띄웁니다. `ensure-local-env.sh`는 API 키 없이 mock 랭킹으로 화면을 볼 수 있게 `.env.local`을 만듭니다. 라이브 수집·칼럼 생성·브리핑 LLM은 `.env.example`의 키를 `.env.local`에 넣으면 됩니다. 배포 기본값은 `https://kindexlab.com`입니다.

GitHub 원본과 동기화하려면:

```bash
git remote add github https://github.com/glory2wide-ship-it/kindexlab.git
git fetch github
git merge github/main
```

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
| `/search?q=` | 칼럼·지수 항목 통합 검색 |

지수(INDEX) 필터: 종합, K-POP 아이돌, 셀럽, 방송, 인플루언서, 실시간 음원 차트, 실시간 시청률 순위, 실시간 웹툰, 숏폼/SNS, 모바일·PC·콘솔 게임. 박스 크기는 거래량, 색상은 선택 타임프레임의 등락률입니다. 카테고리 딥링크는 `/?category=kpop#heatmap` 형식입니다.

## 일일 브리핑 자동화

매일 KST 07:00(`0 22 * * *` UTC)에 종합 1편 + 히트맵 전 카테고리 심층(급등·급락 분석, H2/H3, 1,000단어 이상)을 생성합니다. 본문은 랭킹 스냅샷을 넣는 결정론적 작성기를 기본으로 하고, `OPENAI_API_KEY`가 있으면 OpenAI로 윤문한 뒤 1,000단어 미만이면 작성기로 되돌립니다. 날짜가 바뀌면 전날 기사는 `/briefing/archive`에서 검색됩니다.

```bash
npm run briefing:generate
npm run briefing:generate -- --force 2026-08-25
```

성공 시 `src/data/briefings/extra.json`에 병합됩니다. Vercel 서버리스 파일시스템은 유지되지 않으므로, 장기 SEO 아카이브는 GitHub Actions(`.github/workflows/daily-briefings.yml`)로 커밋하거나 같은 명령을 CI에서 돌리면 됩니다. 런타임에 오늘 날짜 에디션이 시드에 없으면 요청 시 생성해 1시간 캐시합니다.

정기 실행은 GitHub Actions가 전담합니다. Vercel Cron은 생성 결과를 저장할 수 없어(런타임 파일시스템이 읽기 전용) 매번 만든 것을 그대로 버리므로 `vercel.json`에서 제거했습니다. 같은 잡을 `/api/cron/briefings`로 직접 호출할 수는 있으며, 이때는 `CRON_SECRET`이 필요합니다. 이미 같은 날짜 슬러그가 있으면 건너뜁니다(`?force=1`로 재생성).

## 이슈 칼럼 (종료)

이슈 칼럼(=premium columns) 메뉴·생성 파이프라인은 종료했습니다. 관련 스케줄 워크플로와 생성 스크립트는 비활성화되어 있으며, 예전 `/posts` URL은 홈/채널 보드로 리다이렉트됩니다.

## 지수와 측정값

두 종류의 숫자가 있고, 섞으면 안 됩니다.

**지수(`buzzScore`)는 파생값입니다.** `scoreFromRank`가 소스의 공개 순위를 880~1,860 구간에 매핑하고, 시청률만 `scoreFromMetric`으로 가구 시청률 %를 직접 환산합니다. z-score도 가중 합산도 없습니다. 따라서 지수는 같은 시점 항목 간 상대 위치일 뿐이고, 사실로 인용할 수 없습니다.

**측정값(`measurement`)은 소스가 발표한 값 그대로입니다.** 단위와 출처를 함께 들고 다니므로 본문과 구조화 데이터에서 인용할 수 있습니다. 순위를 변형해 만든 값(`Math.max(1, 24 - index)`)은 측정값으로 취급하지 않습니다. 순위가 이미 담고 있는 정보 외에 아무것도 더하지 않기 때문입니다.

현재 측정값을 제공하는 소스는 네이버웹툰(독자 별점), SteamSpy·스팀(동시 접속자), 닐슨코리아(가구 시청률)입니다. 관측은 `snapshot.measurementHistory`에 슬러그별로 누적되며, 직전 관측과 비교한 `changeRate`가 계산됩니다. 값이 바뀌지 않으면 기록하지 않습니다. 수집은 5분 주기인데 대부분의 소스는 훨씬 느리게 갱신되므로, 중복을 쌓으면 실제 변동이 창 밖으로 밀려납니다.

분·주·월 구간 차트(`src/lib/timeframes.ts`)는 시드 난수와 사인파로 그리는 참고용 시각화입니다. 관측 이력이 아니며 화면에도 그렇게 표기합니다. 측정 이력이 충분히 쌓이면 이 시리즈를 실측 기준으로 교체할 수 있습니다.

방법론 문구(`src/data/methodology.ts`)는 위 로직을 그대로 서술합니다. 산출 방식을 바꾸면 문구도 함께 고쳐야 합니다.

## 실제 데이터 연결

`src/lib/api.ts`의 `getRankings()`만 교체하면 됩니다. 로컬은 기본이 mock 픽스처이고(`getTrendsSource()`가 Vercel 밖에서 `mock`으로 떨어집니다), 실수집 경로를 확인하려면 `TRENDS_DATA_SOURCE=live`를 설정하거나 `npx tsx scripts/_check-measurement-live.ts`를 씁니다.
