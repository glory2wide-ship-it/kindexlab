import Link from "next/link";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:grid-cols-2 md:grid-cols-5">
        <div>
          <p className="font-semibold">{SITE.name}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            K-컬처·엔터테인먼트·인플루언서 화제성을 주식 지수(INDEX)처럼 보여주는 트렌드
            랭킹. {SITE.domain}에서 제공합니다. 데이터는 관측값이며 실제 투자 정보가 아닙니다.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-medium">바로가기</p>
          <ul className="mt-2 space-y-1.5 text-muted">
            <li>
              <Link href="/" className="hover:text-ink">
                실시간 지수(INDEX)
              </Link>
            </li>
            <li>
              <Link href="/briefing" className="hover:text-ink">
                데일리 트렌드 브리핑
              </Link>
            </li>
            <li>
              <Link href="/posts" className="hover:text-ink">
                전체 이슈 칼럼
              </Link>
            </li>
            <li>
              <Link href="/briefing/archive" className="hover:text-ink">
                브리핑 아카이브
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-ink">
                소개
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium">카테고리</p>
          <ul className="mt-2 space-y-1.5 text-muted">
            {POST_CHANNELS.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium">정책</p>
          <ul className="mt-2 space-y-1.5 text-muted">
            <li>
              <Link href="/privacy" className="hover:text-ink">
                개인정보처리방침
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-ink">
                이용약관
              </Link>
            </li>
            <li>
              <Link href="/disclaimer" className="hover:text-ink">
                면책조항
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-ink">
                문의하기
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-medium">운영사</p>
          <p className="mt-2 leading-6 text-muted">
            {SITE.companyShort}
            <br />
            {SITE.name} ({SITE.nameKo})
            <br />
            {SITE.domain}
            <br />
            운영 이메일
            <br />
            <a href={`mailto:${SITE.contactEmail}`} className="hover:text-ink">
              {SITE.contactEmail}
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center font-sans text-[11px] leading-5 text-muted">
        히트맵 종목은 1분 마다 갱신, 브리핑 매거진은 매일 1회 갱신됩니다.
        <br />
        © {year} {SITE.companyShort} · {SITE.name} All rights reserved.
      </div>
    </footer>
  );
}
