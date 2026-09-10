import { fetchCategoryLiveSources } from "@/lib/ingestion/sources/category-live";

async function main() {
  const sources = await fetchCategoryLiveSources();
  const ok = sources.filter((s) => s.ok);
  console.log(
    JSON.stringify(
      {
        total: sources.length,
        ok: ok.length,
        fail: sources.filter((s) => !s.ok).slice(0, 5).map((s) => ({ id: s.id, error: s.error })),
        samples: ok.slice(0, 8).map((s) => ({
          id: s.id,
          count: s.count,
          top: s.items.slice(0, 3).map((i) => i.title),
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
