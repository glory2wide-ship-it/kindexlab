import Link from "next/link";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-semibold">{SITE.name}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            K-컬처·엔터테인먼트·인플루언서 화제성을 주식 시세판처럼 보여주는 트렌드
            랭킹. 데이터는 시뮬레이션이며 실제 투자 정보가 아닙니다.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-medium">바로가기</p>
          <ul className="mt-2 space-y-1.5 text-muted">
            <li>
              <Link href="/" className="hover:text-ink">
                실시간 시세판
              </Link>
            </li>
            <li>
              <Link href="/briefing" className="hover:text-ink">
                데일리 트렌드 브리핑
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
          <p className="font-medium">운영사</p>
          <p className="mt-2 leading-6 text-muted">
            {SITE.company}
            <br />
            {SITE.name} ({SITE.nameKo})
          </p>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center font-mono text-[11px] text-muted">
        © {year} {SITE.company} · {SITE.name} All rights reserved.
      </div>
    </footer>
  );
}
