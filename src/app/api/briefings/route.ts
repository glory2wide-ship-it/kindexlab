import type { NextRequest } from "next/server";
import { parseEditionDate } from "@/lib/briefing/dates";
import {
  getArchiveBriefings,
  getBriefingsByDate,
  getTodaysBriefings,
  groupBriefingsByDate,
  listAllBriefings,
  listEditionDates,
  parseCategoryParam,
  parseScopeParam,
  searchBriefings,
} from "@/lib/briefing/store";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = parseEditionDate(searchParams.get("date") ?? undefined);
  const category = parseCategoryParam(searchParams.get("category") ?? undefined);
  const query = searchParams.get("q") ?? undefined;
  const grouped = searchParams.get("grouped") === "1";
  const scope = parseScopeParam(searchParams.get("scope") ?? undefined);

  const pool = date
    ? await getBriefingsByDate(date)
    : scope === "today"
      ? await getTodaysBriefings()
      : scope === "archive"
        ? await getArchiveBriefings()
        : await listAllBriefings();

  const articles = searchBriefings(
    pool,
    query,
    category && category !== "all" ? category : undefined,
  );

  const body = {
    date: date ?? null,
    scope: date ? "date" : scope,
    count: articles.length,
    dates: date ? [date] : await listEditionDates(),
    articles: grouped ? undefined : articles,
    groups: grouped ? groupBriefingsByDate(articles) : undefined,
  };

  return Response.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
