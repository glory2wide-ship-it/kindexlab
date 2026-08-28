import { composeChannelEdition, evaluateBriefingSpec } from "../src/lib/briefing/compose";
import { editionDateTime, kstDateString } from "../src/lib/briefing/dates";
import { composeTodayAnalysis, evaluateTodayAnalysis } from "../src/lib/editorial/today-analysis";
import { MARKET_TAPE } from "../src/lib/editorial/rules";
import { composePoliticsDeskArticle } from "../src/lib/politics/desk-article";
import { getPresidentialPolls } from "../src/lib/politics/polls";
import { getRankings } from "../src/lib/providers/trends";
import { listPosts } from "../src/lib/posts/store";
import { evaluatePostSpec } from "../src/lib/content-generator";
import { POST_CHANNELS } from "../src/lib/posts/channels";

function tape(text: string): string | null {
  return text.match(new RegExp(MARKET_TAPE, "g"))?.[0] ?? null;
}

async function main() {
  const editionDate = kstDateString();
  const market = await getRankings();
  const rows: Record<string, unknown>[] = [];

  for (const channel of POST_CHANNELS) {
    const edition = composeChannelEdition(
      market,
      channel.id,
      editionDate,
      editionDateTime(editionDate),
    );
    for (const article of edition) {
      const report = evaluateBriefingSpec(article);
      const text = [
        article.title,
        article.excerpt,
        ...article.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs]),
        ...(article.faq ?? []).flatMap((f) => [f.question, f.answer]),
      ].join(" ");
      rows.push({
        surface: `briefing:${channel.id}:${article.deskId}`,
        ok: report.ok,
        words: report.wordCount,
        tape: tape(text),
        failures: report.failures,
      });
    }
  }

  for (const entity of market.items.slice(0, 6)) {
    const article = composeTodayAnalysis({ entity, market, editionDate });
    const report = evaluateTodayAnalysis(article);
    const text = [
      article.title,
      article.excerpt,
      ...article.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
      ...article.faq.flatMap((f) => [f.question, f.answer]),
    ].join(" ");
    rows.push({
      surface: `today:${entity.slug}`,
      ok: report.ok,
      words: report.wordCount,
      tape: tape(text),
      failures: report.failures,
    });
  }

  for (const post of await listPosts()) {
    const report = evaluatePostSpec(post);
    const text = [
      post.title,
      post.excerpt,
      ...post.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
      ...(post.faq ?? []).flatMap((f) => [f.question, f.answer]),
    ].join(" ");
    rows.push({
      surface: `post:${post.slug}`,
      ok: report.ok,
      words: post.wordCount,
      tape: tape(text),
      failures: report.failures,
    });
  }

  const polls = await getPresidentialPolls();
  const desk = composePoliticsDeskArticle({ polls, market, editionDate });
  const deskReport = evaluateBriefingSpec(desk);
  rows.push({
    surface: "politics:desk",
    ok: deskReport.ok,
    words: deskReport.wordCount,
    tape: tape(
      [
        desk.title,
        desk.excerpt,
        ...desk.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs]),
      ].join(" "),
    ),
    failures: deskReport.failures,
  });

  const bad = rows.filter((row) => !row.ok || row.tape);
  console.log(JSON.stringify({ total: rows.length, bad }, null, 2));
  if (bad.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
