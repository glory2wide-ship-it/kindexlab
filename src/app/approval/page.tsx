import type { Metadata } from "next";
import Link from "next/link";
import { DailyBriefing } from "@/components/briefing/DailyBriefing";
import { AgencyPollComparisonBoard } from "@/components/politics/AgencyPollComparisonBoard";
import { loadPoliticsDeskCopy } from "@/lib/politics/desk-store";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "대통령 지지도",
  description: "한국갤럽·리얼미터 등 여론조사 기관 TOP 10 공표 기준 대통령 직무 평가 비교 보드입니다.",
  alternates: { canonical: "/approval" },
  openGraph: {
    title: `대통령 지지도 · ${SITE.name}`,
    description: "여론조사 기관 TOP 10 공표 기준 대통령 직무 평가 비교 보드.",
    url: `${SITE.url}/approval`,
  },
};

export default async function PresidentialApprovalPage() {
  const desk = await loadPoliticsDeskCopy();

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="font-sans text-xs font-semibold tracking-[0.14em] text-accent">
          PRESIDENTIAL POLL DESK
        </p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">대통령 지지도</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted">
          한국갤럽·리얼미터·엠브레인퍼블릭 등 국내 대표 여론조사 기관 TOP 10의 최근 공표를 한 표에서 비교합니다.{" "}
          <Link href="/politics" className="underline hover:text-ink">
            정치 시세판
          </Link>
          의 정당·정치인 칸은 뉴스 언급 대용치이며 이 표와 섞지 않습니다. 상승 빨강 · 하락 파랑.
        </p>
      </header>
      <AgencyPollComparisonBoard snapshot={desk.polls} />
      <DailyBriefing briefing={desk.explainer} />
    </div>
  );
}
