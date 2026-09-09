import fs from "node:fs";
import { loadUnifiedMarket } from "@/lib/boards/composite-desk";
import { loadChannelHeatmapPayloads, clearChannelHeatmapMemo } from "@/lib/boards/heatmap-server";

async function main() {
  clearChannelHeatmapMemo();
  const snapshot = JSON.parse(fs.readFileSync("src/data/ingestion/snapshot.json", "utf8"));
  const market = {
    updatedAt: snapshot.updatedAt,
    status: "open",
    indices: [],
    items: snapshot.items,
  } as Parameters<typeof loadUnifiedMarket>[0];

  const live = await loadUnifiedMarket(market!);
  console.log("LANDING LIVE TOPS:");
  console.log(
    live.items.map((item) => `${item.rank}.${item.name}[${item.sourceChannel}/${item.type}]`).join("\n"),
  );
  console.log("\nDESKS:");
  for (const desk of live.desks) {
    console.log(desk.label, "→", desk.top.map((row) => row.name).join(", "));
  }

  const ent = await loadChannelHeatmapPayloads("entertainment");
  const music = ent.find((board) => board.slug === "realtime-music-chart");
  const kpop = ent.find((board) => board.slug === "kpop-fandom-power");
  const games = ent.find((board) => board.slug === "game-esports-ranking");
  console.log("\nMUSIC TOP5", music?.ranking.slice(0, 5).map((row) => row.name));
  console.log("KPOP TOP5", kpop?.ranking.slice(0, 5).map((row) => row.name));
  console.log("GAMES TOP5", games?.ranking.slice(0, 5).map((row) => row.name));

  const pol = await loadChannelHeatmapPayloads("politics");
  const infl = pol.find((board) => board.slug === "political-influencer-power");
  const search = pol.find((board) => board.slug === "policy-controversy-index");
  console.log("POL INFL TOP5", infl?.ranking.slice(0, 5).map((row) => row.name));
  console.log("POL SEARCH TOP5", search?.ranking.slice(0, 5).map((row) => row.name));

  // Seed baselines from registry-ish known names
  const seedMusic = ["APT. 로제", "뛰어 BLACKPINK", "Whiplash 에스파"];
  const liveMusic = music?.ranking.slice(0, 3).map((row) => row.name) ?? [];
  console.log(
    "\nMusic differs from classic seeds?",
    liveMusic.join("|") !== seedMusic.join("|"),
    "→",
    liveMusic.join(", "),
  );
}

void main();
