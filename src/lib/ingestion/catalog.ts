import { rankings } from "@/data/rankings";
import { namesOverlap, normalizeName } from "@/lib/ingestion/names";
import type { CatalogMatch } from "@/lib/ingestion/types";

const catalog: CatalogMatch[] = rankings.map((item) => ({
  slug: item.slug,
  name: item.name,
  nameEn: item.nameEn,
  type: item.type,
  products: item.products,
  tags: item.tags,
}));

export function matchCatalog(name: string, extra?: string): CatalogMatch | undefined {
  const direct = catalog.find(
    (item) => namesOverlap(item.name, name) || namesOverlap(item.nameEn, name) || (extra && namesOverlap(item.name, extra)),
  );
  if (direct) return direct;
  return catalog.find((item) => {
    const haystack = normalizeName(`${name} ${extra ?? ""}`);
    return normalizeName(item.name).length >= 2 && haystack.includes(normalizeName(item.name));
  });
}

export function catalogEntries(): CatalogMatch[] {
  return catalog;
}
