/**
 * Guards for related-news quality (entity overlap + channel sense).
 *   npx tsx scripts/_check-news-link-quality.ts
 */
import assert from "node:assert/strict";
import { scoreNewsLinkQuality } from "../src/lib/entity/category-info/news";

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

console.log("news-link-quality OK");
