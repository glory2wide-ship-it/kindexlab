import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: `${SITE.name}가 수집·이용·보관하는 개인정보 처리 기준. Google 광고 쿠키 안내 포함. ${SITE.companyShort} 운영.`,
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="PRIVACY POLICY" title="개인정보처리방침" updated="2026-08-25">
      <LegalSection title="1. 목적">
        <p>
          {SITE.company}(이하 “회사”)는 {SITE.name}({SITE.nameKo}, 이하 “서비스”)를 운영하면서
          「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 및 관련 법령을
          준수합니다. 이 방침은 이용자가 서비스를 이용할 때 어떤 정보가 어떤 목적으로 처리되는지,
          누구에게 제공·이전되는지, 얼마나 보관되는지를 알리기 위해 공개합니다.
        </p>
      </LegalSection>
      <LegalSection title="2. 수집하는 정보">
        <p>
          회사는 원칙적으로 회원가입을 강제하지 않으며, 열람만으로 지수(INDEX)와 브리핑을 이용할 수
          있습니다. 처리될 수 있는 정보는 다음과 같습니다.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            문의 시 이용자가 자발적으로 제공하는 이름, 이메일 주소, 문의 제목·내용. 접수는{" "}
            {SITE.contactEmail} 또는 문의하기 페이지를 통해 이루어집니다.
          </li>
          <li>
            서비스 이용 과정에서 자동 수집되는 접속 기록, 브라우저 종류, 기기 정보, 쿠키, 참조
            URL, IP 주소(로그). 통계·보안·장애 대응에 사용합니다.
          </li>
          <li>
            광고 네트워크(Google AdSense 등)가 이용자 기기에서 수집할 수 있는 쿠키, 광고
            식별자, 대략적 위치·관심사 추정 정보. 회사는 이 원데이터를 직접 저장하지 않으며,
            해당 사업자의 정책이 적용됩니다.
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="3. 이용 목적">
        <p>수집된 정보는 다음 목적에 한해 이용합니다.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>서비스 제공, 콘텐츠 표시, 장애 대응 및 부정 이용 방지.</li>
          <li>문의 응대, 권리 침해 신고 처리 및 법령상 의무 이행.</li>
          <li>방문 통계 분석과 서비스 개선.</li>
          <li>이용자가 동의한 범위의 맞춤형 또는 일반 광고 표시(광고 사업자가 처리).</li>
        </ul>
      </LegalSection>
      <LegalSection title="4. 쿠키, Google 광고 및 맞춤형 광고">
        <p>
          서비스는 이용 편의와 트래픽 측정을 위해 쿠키를 사용할 수 있습니다. 브라우저 설정에서
          쿠키를 거부할 수 있으나, 일부 기능이 제한될 수 있습니다.
        </p>
        <p>
          회사는 Google AdSense를 포함한 제3자 광고를 게재할 수 있습니다. Google을 포함한 제3자
          벤더는 이용자가 본 사이트 또는 다른 사이트를 방문한 기록을 바탕으로 광고를 게재하기
          위해 쿠키를 사용합니다. Google의 광고 쿠키 사용은 Google과 그 파트너가 이용자의 본
          사이트 및 인터넷상 다른 사이트 방문 기록을 기반으로 광고를 제공할 수 있게 합니다.
        </p>
        <p>
          이용자는{" "}
          <a
            href="https://adssettings.google.com"
            className="text-accent hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google 광고 설정
          </a>
          에서 맞춤형 광고를 해제할 수 있으며,{" "}
          <a
            href="https://www.aboutads.info/choices"
            className="text-accent hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            aboutads.info
          </a>
          를 통해 일부 제3자 벤더의 맞춤형 광고를 거부할 수 있습니다. Google이 파트너 사이트에서
          데이터를 사용하는 방식은{" "}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            className="text-accent hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            policies.google.com/technologies/partner-sites
          </a>
          및{" "}
          <a
            href="https://policies.google.com/technologies/ads"
            className="text-accent hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            Google 광고 정책
          </a>
          을 참고하십시오.
        </p>
      </LegalSection>
      <LegalSection title="5. 제3자 제공, 처리 위탁 및 국외 이전">
        <p>
          회사는 이용자의 동의 없이 개인정보를 제3자에게 판매하거나 제공하지 않습니다. 다만
          법령에 따른 요청, 수사기관의 적법한 절차, 서비스 호스팅·분석·광고 등 처리 위탁이
          필요한 경우에는 수탁자와 업무 범위를 관리합니다.
        </p>
        <p>
          현재 예상되는 수탁·제3자 범주는 클라우드 호스팅, 웹 분석, 광고 네트워크입니다. Google
          AdSense 등 Google 서비스가 사용되는 경우, 광고·측정 목적의 정보가 미국 등 국외에
          위치한 Google 서버에서 처리될 수 있습니다. 이전 항목은 쿠키·광고 식별자·접속 로그
          성격의 정보이며, 이전 시기는 페이지 열람 시, 보유 기간은 해당 사업자 정책에 따릅니다.
        </p>
      </LegalSection>
      <LegalSection title="6. 보유 기간">
        <p>
          문의 메일은 응대 완료 후 3년간 보관할 수 있으며, 접속 기록은 통신비밀보호법 등 관련
          법령이 정한 기간 동안 보관합니다. 목적 달성 또는 기간 만료 시 지체 없이 파기합니다.
          전자 파일은 복구 불가능한 방법으로 삭제하고, 출력물은 분쇄 또는 소각합니다.
        </p>
      </LegalSection>
      <LegalSection title="7. 이용자의 권리">
        <p>
          이용자는 자신의 개인정보에 대해 열람, 정정·삭제, 처리 정지, 동의 철회를 요청할 수
          있습니다. 요청은{" "}
          <a href={`mailto:${SITE.contactEmail}`} className="text-accent hover:underline">
            {SITE.contactEmail}
          </a>
          또는{" "}
          <a href="/contact" className="text-accent hover:underline">
            문의하기
          </a>
          페이지를 통해 접수합니다. 회사는 정당한 요청을 지체 없이 처리합니다. 만 14세 미만
          아동의 개인정보를 고의로 수집하지 않으며, 해당 정보가 확인되면 즉시 삭제합니다.
        </p>
      </LegalSection>
      <LegalSection title="8. 안전성 확보 조치">
        <p>
          회사는 접근 권한 최소화, 전송 구간 암호화(HTTPS), 접속 기록 보관, 보안 업데이트 적용
          등 합리적인 보호 조치를 시행합니다. 다만 인터넷 특성상 모든 위험을 완전히 제거할 수는
          없습니다.
        </p>
      </LegalSection>
      <LegalSection title="9. 개인정보 보호책임자">
        <p>
          개인정보 관련 문의·불만·피해 구제는 아래로 연락해 주십시오. 회사는 접수된 내용을
          신속히 답변합니다.
        </p>
        <ul className="list-none space-y-1 pl-0">
          <li>운영 주체: {SITE.company} ({SITE.companyShort})</li>
          <li>서비스명: {SITE.name} ({SITE.nameKo})</li>
          <li>개인정보 보호책임자: {SITE.companyShort} 운영팀</li>
          <li>
            이메일:{" "}
            <a href={`mailto:${SITE.contactEmail}`} className="text-accent hover:underline">
              {SITE.contactEmail}
            </a>
          </li>
          <li>
            문의 페이지:{" "}
            <a href="/contact" className="text-accent hover:underline">
              {`${SITE.url}/contact`}
            </a>
          </li>
        </ul>
      </LegalSection>
      <LegalSection title="10. 방침의 변경">
        <p>
          이 방침을 변경하는 경우 서비스 공지 또는 본 페이지의 시행일을 갱신하여 알립니다.
          중요한 변경은 시행 7일 전에 고지하는 것을 원칙으로 합니다.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
