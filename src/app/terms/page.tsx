import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

const CATEGORY_LIST = POST_CHANNELS.map((item) => item.label).join(", ");

export const metadata: Metadata = {
  title: "이용약관",
  description: `${SITE.name} 웹사이트 이용 조건. ${SITE.companyShort} 운영.`,
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="TERMS OF SERVICE" title="이용약관" updated="2026-09-03">
      <LegalSection title="1. 약관의 적용">
        <p>
          이 약관은 {SITE.company}(이하 “회사”)가 운영하는 {SITE.name}({SITE.nameKo}) 웹사이트 및
          관련 서비스(이하 “서비스”)의 이용 조건과 회사·이용자의 권리·의무를 정합니다. 서비스를
          열람하거나 이용하는 행위는 이 약관에 동의하는 것으로 봅니다.
        </p>
      </LegalSection>
      <LegalSection title="2. 서비스의 내용">
        <p>
          서비스는 {CATEGORY_LIST} 카테고리의 이슈·화제성을 지수(INDEX)·랭킹 보드·데일리
          브리핑·심층 분석·이슈 칼럼 형태로 제공합니다. 순위, 등락률, 거래량, 지수는 공개된
          검색·차트·뉴스 신호와 회사의 가중치 모델을 결합한 관측값이며, 금융상품의 시세나 투자
          권유가 아닙니다. 데이터 원천과 갱신 주기는 운영 상황에 따라 달라질 수 있습니다.
        </p>
      </LegalSection>
      <LegalSection title="3. 이용자의 의무">
        <ul className="list-disc space-y-2 pl-5">
          <li>법령, 이 약관, 서비스에 게시된 안내를 준수합니다.</li>
          <li>자동화된 대량 수집, 스크래핑, 서비스 장애를 유발하는 접근을 하지 않습니다.</li>
          <li>타인의 권리를 침해하거나 허위 정보를 유포하지 않습니다.</li>
          <li>광고·제휴 모듈을 부정 클릭하거나 수익을 조작하지 않습니다.</li>
        </ul>
      </LegalSection>
      <LegalSection title="4. 지식재산권">
        <p>
          서비스의 상표, 레이아웃, 소프트웨어, 브리핑 본문, 시각화 구성은 회사 또는 정당한
          권리자에게 귀속됩니다. 이용자는 개인적 열람 외에 복제, 배포, 공중송신, 2차적 저작물
          작성을 해서는 안 됩니다. 제3자 콘텐츠(음원 차트명, 프로그램명, 인물명, 정책·상품명
          등)의 권리는 해당 권리자에게 있습니다.
        </p>
      </LegalSection>
      <LegalSection title="5. 게시와 변경">
        <p>
          회사는 서비스의 전부 또는 일부를 점검, 개선, 운영상 이유로 변경하거나 일시 중단할 수
          있습니다. 중요한 변경은 가능한 범위에서 사전에 알립니다. 무료 서비스의 특성상 특정
          기능의 계속 제공을 보장하지 않습니다.
        </p>
      </LegalSection>
      <LegalSection title="6. 면책">
        <p>
          순위·분석 문장은 정보 제공 목적이며 특정 결과(인기, 매출, 투자 수익 등)를 보장하지
          않습니다. 통신 장애, 제3자 데이터 오류, 천재지변으로 인한 손해에 대해 회사는 법령이
          허용하는 범위에서 책임을 제한합니다. 자세한 고지는{" "}
          <a href="/disclaimer" className="text-accent hover:underline">
            면책조항
          </a>
          을 따릅니다.
        </p>
      </LegalSection>
      <LegalSection title="7. 광고와 제휴">
        <p>
          서비스에는 제3자 광고(Google AdSense 등) 및 제휴 상품 모듈이 포함될 수 있습니다. 광고
          클릭 후 이루어지는 거래의 당사자는 이용자와 해당 사업자이며, 회사는 거래 조건을
          보증하지 않습니다. 쿠키·맞춤형 광고에 관한 안내는{" "}
          <a href="/privacy" className="text-accent hover:underline">
            개인정보처리방침
          </a>
          을 따릅니다.
        </p>
      </LegalSection>
      <LegalSection title="8. 개인정보">
        <p>
          회사의 개인정보 처리에 관한 사항은 개인정보처리방침에 따릅니다. 문의·권리 행사는{" "}
          <a href={`mailto:${SITE.contactEmail}`} className="text-accent hover:underline">
            {SITE.contactEmail}
          </a>
          로 접수합니다.
        </p>
      </LegalSection>
      <LegalSection title="9. 준거법과 분쟁">
        <p>
          이 약관은 대한민국 법령을 준거법으로 합니다. 서비스 이용과 관련한 분쟁은 민사소송법상
          관할 법원에 제소합니다. 약관에 정하지 않은 사항은 관련 법령과 상관례를 따릅니다.
        </p>
      </LegalSection>
      <LegalSection title="10. 연락처">
        <p>
          운영 주체: {SITE.company} ({SITE.companyShort})
          <br />
          약관 문의:{" "}
          <a href={`mailto:${SITE.contactEmail}`} className="text-accent hover:underline">
            {SITE.contactEmail}
          </a>
          {" · "}
          <a href="/contact" className="text-accent hover:underline">
            문의하기
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
