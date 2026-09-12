# KinDex

디엘파크주식회사가 운영하는 K-컬처 화제 지수(INDEX)입니다. 도메인: [kindexlab.com](https://kindexlab.com). Finviz 스타일 트리맵과 리스트로 버즈·음원·시청률·웹툰·숏폼·게임을 보여 주며, Google AdSense 자동 광고와 쿠팡 파트너스 연동을 전제로 합니다.

문의: glory2wide@gmail.com

## 실행

GitHub 저장소: [glory2wide-ship-it/kindexlab](https://github.com/glory2wide-ship-it/kindexlab)

```bash
npm ci
./scripts/ensure-local-env.sh
npm run dev
```

기본 개발 서버는 `http://localhost:3000`입니다. Cursor Cloud Agent에서는 `npm run dev:cloud`로 `http://127.0.0.1:43123`에 띄웁니다. `ensure-local-env.sh`는 `.env.local`을 만들고 기본 소스를 live(크롤러 스냅샷)로 둡니다. 픽스처만 보려면 `TRENDS_DATA_SOURCE=mock`과 `TRENDS_ALLOW_MOCK=1`을 명시하세요. 라이브 수집·칼럼 생성·브리핑 LLM은 `.env.example`의 키를 `.env.local`에 넣으면 됩니다. 배포 기본값은 `https://kindexlab.com`입니다.

GitHub 원본과 동기화하려면:

```bash
git remote add github https://github.com/glory2wide-ship-it/kindexlab.git
git fetch github
git merge github/main
```

## 스택

- Next.js App Router + TypeScript
- Tailwind CSS v4
- 트리맵 레이아웃 (1위 좌측 정사각, 2위 하단, 나머지 squarify)
- Vercel 배포 (`npm run build`) — 서버리스 리전은 서울(`icn1`)로 고정 (`vercel.json` + `preferredRegion`)

## 성능 메모

- 페이지 ISR `revalidate = 180`과 함께, SSR 경로의 외부 fetch는 `next: { revalidate }`를 사용합니다. `cache: "no-store"`를 페이지 렌더에 쓰면 Vercel CDN이 HTML을 캐시하지 않습니다.
- 라이브 시세·보드 갱신은 3분 캐시, 인제스트/크론은 `no-store`를 유지합니다.
- 홈(`/`)은 `getRankings()` 워터폴 없이 보드 ISR만 조립하고, H1을 Suspense로 먼저 스트리밍합니다. Pretendard CDN CSS는 비차단 로드입니다.
- `/ranking/[slug]` 오늘의 분석은 빌드 시 `cache.json`을 slug 샤드로 나눠, 콜드 스타트마다 5MB JSON을 파싱하지 않습니다. 히트맵 호버 차트는 마우스오버 때만 시리즈를 만듭니다.

## 화면

| 경로 | 역할 |
| --- | --- |
| `/` | 히트맵/리스트 지수(INDEX), 타임프레임(3m~60m, Daily, Weekly, Monthly), 오늘의 브리핑 레일 |
| `/ranking/[slug]` | 분봉·일·주·월 차트, 쿠팡 상품 |
| `/briefing` | 오늘 발행분 허브(종합 1 + Update 키워드) |
| `/briefing/[slug]` | 1,000단어+ H2/H3 브리핑 본문 |
| `/briefing/archive` | 어제 이전 에디션 검색·카테고리 필터 |
| `/about` | 데이터 구성·랭킹 산출 방식 |
| `/privacy` | 개인정보처리방침 |
| `/terms` | 이용약관 |
| `/disclaimer` | 면책조항 |
| `/contact` | 문의하기 |
| `/api/rankings` | 랭킹 JSON |
| `/api/cron/briefings` | 일일 브리핑 생성 잡(CRON_SECRET) |
| `/search?q=` | 칼럼·지수 항목 통합 검색 |

지수(INDEX) 필터: 종합, K-POP 아이돌, 셀럽, 방송, 인플루언서, 실시간 음원 차트, 실시간 시청률 순위, 실시간 웹툰, 숏폼/SNS, 모바일·PC·콘솔 게임. 박스 크기는 거래량, 색상은 선택 타임프레임의 등락률입니다. 카테고리 딥링크는 `/?category=kpop#heatmap` 형식입니다.

## 일일 브리핑 자동화

GitHub Actions `Daily briefings`가 **매일 04:00 KST**(`0 19 * * *` UTC)에 채널 종합·하위 메뉴 심층 브리핑을 Gemini Batch로 생성해 `src/data/briefings/extra.json`에 커밋합니다. `Heatmap today's analysis`는 **05:00 KST**에 이어집니다.

생성 직후 **성공/실패 목록 + Gemini API 추정 비용** 보고서를 `glory2wide@gmail.com`으로 보냅니다. Gmail 수신을 쓰려면 저장소 **Settings → Secrets and variables → Actions**에 아래 중 하나를 넣어야 합니다.

| Secret | 용도 |
| --- | --- |
| `RESEND_API_KEY` | [Resend](https://resend.com) API (권장). 미인증 도메인이면 From은 `onboarding@resend.dev`, 수신은 Resend 가입 메일과 같아야 합니다. |
| `SMTP_USER` + `SMTP_PASS` | Gmail SMTP. `SMTP_USER`는 Gmail 주소, `SMTP_PASS`는 [앱 비밀번호](https://myaccount.google.com/apppasswords) (계정 비밀번호 아님). |
| `REPORT_EMAIL_FROM` | (선택) From 표시명. SMTP 사용 시 보통 `SMTP_USER`와 동일. |

시크릿이 없으면 Gmail은 **발송되지 않고**, 같은 내용이 GitHub Issue(`generation-report` 라벨)로만 남습니다. 예: [#7 2026-09-09 보고](https://github.com/glory2wide-ship-it/kindexlab/issues/7).

```bash
npm run briefing:generate
npm run briefing:generate -- --force 2026-08-25
```

성공 시 `src/data/briefings/extra.json`에 병합됩니다. Vercel 서버리스 파일시스템은 유지되지 않으므로, 장기 SEO 아카이브는 GitHub Actions로 커밋합니다.
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

`src/lib/api.ts`의 `getRankings()`만 교체하면 됩니다. 기본 소스는 **live**(크롤러 스냅샷)입니다. 로컬에서 픽스처만 보려면 `TRENDS_DATA_SOURCE=mock`을 명시하세요. Production/Vercel에서는 mock이 무시됩니다(`TRENDS_ALLOW_MOCK=1`로만 허용). 스냅샷 신선도·소스 실패율은 `npm run trends:health` 또는 `GET /api/health/trends`로 검사합니다.
