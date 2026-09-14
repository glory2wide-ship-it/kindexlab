# 검색엔진 등록 · AdSense 전 체크리스트

운영 호스트는 **`https://www.kindexlab.com`** 입니다. apex(`https://kindexlab.com`)는 Vercel에서 www로 308 리다이렉트되므로 Search Console / 서치어드바이저 / sitemap 제출은 **www** 기준으로 진행하세요.

이미 준비된 것:

- `https://www.kindexlab.com/robots.txt`
- `https://www.kindexlab.com/sitemap.xml`
- 정책 페이지: `/terms`, `/disclaimer`, `/contact`, `/privacy`
- 소유권 메타: Google 확인 토큰은 `src/lib/seo-verification.ts`에 반영됨. 네이버는 `NAVER_SITE_VERIFICATION` env 또는 동일 파일 기본값

로컬·프로덕션 헬스:

```bash
npm run seo:check
```

## 1. Google Search Console

1. [Search Console](https://search.google.com/search-console) → 속성 추가
2. **URL 접두어** 권장: `https://www.kindexlab.com`
3. 소유권 확인 — HTML 태그 방식 (Google 토큰은 코드에 반영됨 → 배포 후 **확인** 클릭)
4. 배포 후 `npm run seo:check`로 홈 HTML에 `google-site-verification` 존재 확인
5. **Sitemaps**에 `https://www.kindexlab.com/sitemap.xml` 제출
6. URL 검사로 주요 URL 색인 요청: `/`, `/entertainment`, `/politics`, `/economy`, `/culture`, `/travel`

## 2. 네이버 서치어드바이저

1. [서치어드바이저](https://searchadvisor.naver.com/) → 웹마스터 도구 → 사이트 추가: `https://www.kindexlab.com`
2. HTML 메타 태그의 `content` 값을 복사
3. Vercel → `NAVER_SITE_VERIFICATION=<content값>` → 재배포
4. `sitemap.xml` 제출, `robots.txt` 수집 확인
5. 주요 URL 수집 요청

## 3. AdSense 전에 같이 볼 것

- 이용약관 / 면책 / 문의 / 개인정보가 실제로 열리는지 (`seo:check`에 포함)
- 홈·카테고리 보드에 빈 히트맵이 없는지
- 색인 요청은 품질 확인된 주요 URL 위주 (sitemap은 이미 저품질 벌크 URL을 제한함)

## 코드 쪽 메모

검증 토큰은 git에 넣지 않습니다. `src/lib/seo-verification.ts`가 env를 읽어 Next `metadata.verification`으로 출력합니다.
