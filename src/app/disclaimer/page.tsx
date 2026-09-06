import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

const CATEGORY_LIST = POST_CHANNELS.map((item) => item.label).join(", ");

export const metadata: Metadata = {
  title: "면책조항",
  description: `${SITE.name} 시세·브리핑은 투자 자문이 아닙니다. 면책 및 투자 정보 고지.`,
  alternates: { canonical: "/disclaimer" },
  robots: { index: true, follow: true },
};

export default function DisclaimerPage() {
  return (
    <LegalPage eyebrow="DISCLAIMER" title="면책조항 / 투자 정보 고지" updated="2026-09-03">
      <LegalSection title="1. 정보 제공 목적">
        <p>
          {SITE.name}({SITE.nameKo})가 표시하는 순위, 등락률, 거래량, 지수, 차트, 데일리 브리핑,
          카테고리 Update 키워드는 모두 {CATEGORY_LIST} 카테고리의 이슈·화제성을 관측하기 위한
          정보입니다. 금융투자상품의 시세, 기업 가치, 신용 평가, 매수·매도 추천이 아닙니다.
        </p>
      </LegalSection>
      <LegalSection title="2. 투자 자문이 아닙니다">
        <p>
          회사({SITE.companyShort})는 자본시장과 금융투자업에 관한 법률상 투자자문업·투자일임업을
          영위하지 않습니다. 본문의 “급등”, “조정”, “수급”, “지수(INDEX)” 등의 표현은 버즈·이슈
          데이터를 주식 차트 문법으로 설명하기 위한 비유이며, 실제 증권·파생상품·가상자산 거래와
          무관합니다. 어떠한 콘텐츠도 개별 투자자의 상황에 맞춘 자문으로 해석되어서는 안 됩니다.
        </p>
      </LegalSection>
      <LegalSection title="3. 데이터의 한계">
        <p>
          수집 원천(검색, 차트, 뉴스, 소셜 신호 등)은 지연, 누락, 오류, 일시 중단이 있을 수
          있습니다. 일부 구간은 정규화·가중치·보간을 사용하므로 원천 사이트와 숫자가 다를 수
          있습니다. 실시간으로 표기되더라도 거래소 시세와 같은 체결 데이터가 아닙니다. 서비스는
          데이터의 완전성, 정확성, 적시성을 보증하지 않습니다.
        </p>
      </LegalSection>
      <LegalSection title="4. 브리핑 본문">
        <p>
          데일리 브리핑과 {CATEGORY_LIST} 카테고리 Update 키워드는 당일 스냅샷을 해석한 편집
          콘텐츠입니다. 가설이 다음날 지수(INDEX)에서 뒤집힐 수 있으며, 회사는 예측 적중을
          약속하지 않습니다. 인물·작품·방송·정책·상품에 대한 평가는 화제성 관측일 뿐
          명예·실적·계약에 대한 단정이 아닙니다.
        </p>
      </LegalSection>
      <LegalSection title="5. 외부 링크와 광고">
        <p>
          서비스에 표시되는 제3자 사이트, 광고, 제휴 상품의 내용·가격·배송·환불은 해당 사업자의
          책임입니다. 링크를 클릭한 이후의 거래에서 발생한 손해에 대해 회사는 고의 또는 중과실이
          없는 한 책임을 지지 않습니다.
        </p>
      </LegalSection>
      <LegalSection title="6. 책임의 제한">
        <p>
          이용자가 서비스 정보를 근거로 내린 결정(소비, 홍보, 투자, 출연 등)의 결과는 이용자
          본인에게 있습니다. 법령이 허용하는 최대 범위에서 회사의 손해배상 책임은 제한됩니다.
          일부 관할에서는 책임 제한이 적용되지 않을 수 있습니다.
        </p>
      </LegalSection>
      <LegalSection title="7. 문의">
        <p>
          운영 주체: {SITE.company} ({SITE.companyShort})
          <br />
          본 고지에 대한 질문은{" "}
          <a href={`mailto:${SITE.contactEmail}`} className="text-accent hover:underline">
            {SITE.contactEmail}
          </a>
          또는{" "}
          <a href="/contact" className="text-accent hover:underline">
            문의하기
          </a>
          로 보내 주십시오.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
