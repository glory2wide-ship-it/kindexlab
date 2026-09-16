/**
 * Smoke-check data.go.kr clients (requires DATA_GO_KR_SERVICE_KEY in env).
 * Usage: npx tsx --env-file=.env.local scripts/_check-public-data.ts
 */
import { searchBizSupport } from "../src/lib/public-data/bizinfo";
import { searchGov24Services, matchGov24Service } from "../src/lib/public-data/gov24";
import { searchPublicGrants, matchPublicGrant } from "../src/lib/public-data/grants";
import { summarizeHousingPublicData, topTradedApartments } from "../src/lib/public-data/housing";
import { hasDataGoKrKey } from "../src/lib/public-data/key";
import { searchCentralWelfare, searchLocalWelfare } from "../src/lib/public-data/welfare";

async function main() {
  if (!hasDataGoKrKey()) {
    console.error("DATA_GO_KR_SERVICE_KEY missing");
    process.exit(1);
  }

  const gov = await searchGov24Services("청년", { perPage: 3 });
  console.log(
    "[gov24]",
    gov.length,
    gov.map((g) => g.title).join(" | "),
  );

  const detail = await matchGov24Service("유아학비");
  console.log("[gov24 detail]", detail?.title, detail?.deadline || detail?.target?.slice(0, 40));

  const central = await searchCentralWelfare("청년", { numOfRows: 2 });
  console.log(
    "[welfare-central]",
    central.length,
    central.map((g) => g.title).join(" | "),
  );

  const local = await searchLocalWelfare("청년", { numOfRows: 2 });
  console.log(
    "[welfare-local]",
    local.length,
    local.map((g) => g.title).join(" | "),
  );

  const housing = await summarizeHousingPublicData("래미안대치팰리스");
  console.log("[rtms]", housing?.regionLabel, housing?.tradeSummary || housing?.rentSummary || "(no apt match yet)");

  const tops = await topTradedApartments("seoul", { limit: 3 });
  console.log(
    "[rtms tops]",
    tops.map((t) => `${t.name}(${t.deals})`).join(", "),
  );

  const grant = await matchPublicGrant("청년도약계좌");
  console.log("[match]", grant?.source, grant?.title);

  const grant2 = await matchPublicGrant("청년");
  console.log("[match-청년]", grant2?.source, grant2?.title);

  const biz = await searchBizSupport("창업", { limit: 3 });
  console.log("[bizinfo]", biz.length ? biz.map((b) => b.title).join(" | ") : "(no endpoint/key yet)");

  const live = await searchPublicGrants("지원금", { limit: 5 });
  console.log(
    "[grants]",
    live.length,
    live.map((g) => `${g.source}:${g.title}`).join(" || "),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
