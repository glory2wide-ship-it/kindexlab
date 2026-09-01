import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TravelRegionDeskPage } from "@/components/travel/TravelRegionDeskPage";
import { TRAVEL_REGION_BOARD_NAV, travelRegionLabel } from "@/lib/constants/nav";
import { isRegionSegment, REGION_SEGMENTS } from "@/lib/boards/regions";
import type { RegionSegment } from "@/lib/boards/types";

export const revalidate = 60;

export function generateStaticParams() {
  return REGION_SEGMENTS.map((region) => ({ region }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegionSegment(region)) return { title: TRAVEL_REGION_BOARD_NAV.domestic.title };
  return {
    title: `${TRAVEL_REGION_BOARD_NAV.domestic.shortTitle} · ${travelRegionLabel(region)}`,
    description: `${travelRegionLabel(region)} 지역 국내 여행지 검색·숙박·교통 화제성 랭킹`,
  };
}

export default async function TravelDomesticRegionPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegionSegment(region)) notFound();
  return (
    <TravelRegionDeskPage
      boardKey="domestic"
      region={region as RegionSegment}
    />
  );
}
