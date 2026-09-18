/**
 * SEO guards from GSC 2026-09-18 coverage/performance review.
 *   npx tsx scripts/_check-seo-gsc-guards.ts
 */
import assert from "node:assert/strict";
import { isUnusableRankName } from "../src/lib/boards/demographics";
import { entityNameLooksIndexable } from "../src/lib/seo/indexable-entity";
import {
  canonicalEntityPathSlug,
  entityHref,
  rankingPath,
} from "../src/lib/slugs";

// Internal links must not emit ?name= duplicates.
assert.equal(
  entityHref({ slug: "government-subsidy-search--청년도약계좌", name: "[금융위원회] 청년도약계좌" }),
  rankingPath("government-subsidy-search--청년도약계좌"),
);
assert.equal(
  entityHref({ slug: "pol-party_support-기본소득당", name: "기본소득당", type: "party_support" }),
  "/politics/" + encodeURIComponent("pol-party_support-기본소득당"),
);
assert.ok(!entityHref({ slug: "food-restaurant-ranking--서울-광장시장", name: "[서울] 광장시장" }).includes("?name="));

// Bracket legacy tails collapse onto live slugify form.
assert.equal(
  canonicalEntityPathSlug("food-restaurant-ranking--[대구]-막창", "[대구] 막창"),
  "food-restaurant-ranking--대구-막창",
);
assert.equal(
  canonicalEntityPathSlug(
    "travel-government-grant-ranking--[한국관광공사]-관광두레",
    "[한국관광공사] 관광두레",
  ),
  "travel-government-grant-ranking--한국관광공사-관광두레",
);

// Junk / placeholder names stay out of sitemap + index gates.
assert.equal(entityNameLooksIndexable("이름 사이 공백"), false);
assert.equal(entityNameLooksIndexable("눈찢기"), false);
assert.equal(isUnusableRankName("이름 사이 공백"), true);
assert.equal(isUnusableRankName("눈찢기"), true);
assert.equal(entityNameLooksIndexable("기본소득당", "party_support"), true);
assert.equal(entityNameLooksIndexable("[금융위원회] 청년도약계좌"), true);

console.log("OK seo gsc guards");
