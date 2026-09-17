/**
 * Guards for related-news quality (entity overlap + channel sense).
 *   npx tsx scripts/_check-news-link-quality.ts
 */
import assert from "node:assert/strict";
import {
  ensureQualityNewsLinks,
  isNewsSearchFallbackUrl,
  isNonArticleMediaUrl,
  scoreNewsLinkQuality,
} from "../src/lib/entity/category-info/news";

const mono = "MONOPOLY GO!";

assert.equal(
  scoreNewsLinkQuality(
    {
      title: "해체설은 무슨… 일본 열도 뒤집은 뉴진스의 ‘이 노래’",
      href: "https://blog.naver.com/newswa_official/224092248992",
      source: "블로그",
    },
    mono,
    "game",
  ),
  0,
  "reject NewJeans blog on game channel",
);

assert.equal(
  scoreNewsLinkQuality(
    {
      title: "kci.go.kr journal.kci.go.kr › kdrama PDF",
      href: "https://journal.kci.go.kr/kdrama/archive/articlePdf?artiId=ART002094027",
      source: "journal.kci.go.kr",
    },
    mono,
    "game",
  ),
  0,
  "reject unrelated kdrama PDF",
);

assert.equal(
  scoreNewsLinkQuality(
    {
      title:
        "2진법영어 지식인 852만 인용 영어 문법 및 학습 방법에 대한 전문성을 갖춘 지식인 답변자로서, 2진법문형코드를 통한 영어 학습법을 공유하고 있습니다.",
      href: "https://kin.naver.com/profile/index.naver?u=abc",
      source: "지식인",
    },
    mono,
    "game",
  ),
  0,
  "reject kin.naver profile",
);

const good = scoreNewsLinkQuality(
  {
    title: "Monopoly Go 무료 주사위 링크: 2026년 9월 매일 업데이트",
    href: "https://example.com/monopoly-go-dice",
    source: "게임 매체",
  },
  mono,
  "game",
);
assert.ok(good >= 2, `expected Monopoly dice guide to score, got ${good}`);

assert.equal(
  scoreNewsLinkQuality(
    {
      title: "코르티스(CORTIS) 나무위키프로필? 데뷔 What You Want",
      href: "https://blog.naver.com/foo/1",
      source: "블로그",
    },
    "Candy Crush Saga",
    "game",
  ),
  0,
  "reject idol blog on Candy Crush",
);

assert.equal(
  scoreNewsLinkQuality(
    {
      title: "근로장려금 신청 안내 클립",
      href: "https://m.naver.com/shorts?serviceType=MOMENT&mediaType=VOD&seedMediaId=ABC",
      source: "네이버",
    },
    "[국세청] 근로장려금",
    "gov_subsidy",
  ),
  0,
  "reject Naver MOMENT/VOD shorts as related news",
);

assert.equal(
  scoreNewsLinkQuality(
    {
      title: "근로장려금 관련 영상",
      href: "https://tv.naver.com/v/12345",
      source: "네이버TV",
    },
    "근로장려금",
    "gov_subsidy",
  ),
  0,
  "reject tv.naver.com clips",
);

assert.equal(
  isNonArticleMediaUrl(
    "https://m.naver.com/shorts/?mediaType=VOD&recId=%7B%22query%22%3A%22%EA%B7%BC%EB%A1%9C%EC%9E%A5%EB%A0%A4%EA%B8%88%22%7D",
  ),
  true,
);

assert.equal(isNonArticleMediaUrl("https://www.ggilbo.com/news/articleView.html?idxno=1180083"), false);

// Never invent “추가 수집 중 · 뉴스 검색” when under-filled.
const padded = ensureQualityNewsLinks(
  "근로장려금",
  [
    {
      title: "근로장려금 검색 결과",
      href: "https://search.naver.com/search.naver?where=news&query=%EA%B7%BC%EB%A1%9C%EC%9E%A5%EB%A0%A4%EA%B8%88",
      source: "뉴스 검색",
    },
  ],
  { minPreferred: 2, maxSearchFallbacks: 1, channel: "gov_subsidy" },
);
assert.equal(padded.length, 0, "must not emit search fallbacks");
assert.ok(
  !padded.some((link) => isNewsSearchFallbackUrl(link.href) || /추가 수집 중/.test(link.title)),
);

const withReal = ensureQualityNewsLinks(
  "근로장려금",
  [
    {
      title: "근로장려금 최대 330만 원 지급…신청 안내",
      href: "https://www.korea.kr/news/policyNewsView.do?newsId=148963769",
      source: "정책브리핑",
    },
    {
      title: "근로장려금 검색",
      href: "https://search.naver.com/search.naver?where=news&query=근로장려금",
      source: "뉴스 검색",
    },
  ],
  { minPreferred: 2, maxSearchFallbacks: 1, channel: "gov_subsidy" },
);
assert.equal(withReal.length, 1);
assert.equal(isNewsSearchFallbackUrl(withReal[0]!.href), false);
assert.ok(!/추가 수집 중/.test(withReal[0]!.title));

console.log("news-link-quality OK");
