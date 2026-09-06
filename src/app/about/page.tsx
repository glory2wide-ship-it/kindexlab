import type { Metadata } from "next";
import { AboutArticle } from "@/components/about/AboutArticle";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "소개",
  description: `${SITE.name}의 데이터 구성과 시세 산출 방식. ${SITE.companyShort} 운영.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return <AboutArticle />;
}
