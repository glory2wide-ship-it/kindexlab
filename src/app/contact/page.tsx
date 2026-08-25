import type { Metadata } from "next";
import { ContactForm } from "@/components/legal/ContactForm";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "문의하기",
  description: `${SITE.name} 운영 문의. 개인정보·제휴·콘텐츠 오류 신고. ${SITE.contactEmail}`,
  alternates: { canonical: "/contact" },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <LegalPage eyebrow="CONTACT" title="문의하기" updated="2026-08-25">
      <LegalSection title="연락처">
        <p>
          {SITE.name}는 {SITE.company}({SITE.companyShort})가 운영합니다. 개인정보, 콘텐츠 오류,
          제휴, 저작권, 광고 관련 문의는 아래 공식 운영 이메일 또는 양식으로 보내 주십시오.
          영업일 기준 가능한 빠르게 회신합니다.
        </p>
        <ul className="list-none space-y-1">
          <li>운영 주체: {SITE.company}</li>
          <li>서비스: {SITE.name} ({SITE.nameKo})</li>
          <li>
            운영 이메일:{" "}
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="text-lg font-medium text-accent hover:underline"
            >
              {SITE.contactEmail}
            </a>
          </li>
          <li>응대: 평일 10:00–18:00 (KST, 공휴일 제외)</li>
        </ul>
      </LegalSection>
      <LegalSection title="메일 보내기">
        <ContactForm />
      </LegalSection>
      <LegalSection title="자주 묻는 유형">
        <ul className="list-disc space-y-2 pl-5">
          <li>시세·차트 오류 신고: 종목명, 시각, 화면 설명을 함께 보내 주세요.</li>
          <li>개인정보 열람·삭제 요청: 본인 확인이 가능한 연락처를 남겨 주세요.</li>
          <li>저작권·초상 관련 요청: 권리 관계와 대상 URL을 명시해 주세요.</li>
          <li>광고·제휴 문의: 매체명과 제안 요지를 적어 주세요.</li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
