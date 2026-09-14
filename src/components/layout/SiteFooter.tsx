import Link from "next/link";
import { POST_CHANNELS } from "@/lib/posts/channels";
import { SITE } from "@/lib/site";

const CATEGORY_LABELS = POST_CHANNELS.map((item) => item.label).join("·");

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-[72rem] gap-6 px-4 py-8 md:grid-cols-3 md:gap-8">
        <div>
          <Link href="/about" className="font-semibold hover:text-ink">
            KinDex / 킨덱스 소개
          </Link>
          <p className="mt-2 text-[0.83125rem] leading-[1.425rem] text-muted">
            {CATEGORY_LABELS} 등 국내 이슈·화제성을 주식 지수(INDEX)처럼 보여주는 트렌드
            랭킹. {SITE.domain}에서 제공합니다. 데이터는 관측값이며 실제 투자 정보가 아닙니다.
          </p>
        </div>
        {/* Mobile: 정책 | 운영사. md+: join the 3-col footer row. */}
        <div className="grid grid-cols-2 gap-3 md:contents">
          <div className="min-w-0 text-[11px] leading-[0.9rem] sm:text-sm sm:leading-[1.35]">
            {/* Match KinDex / 킨덱스 소개 weight+size (font-semibold, inherit size). */}
            <p className="font-semibold leading-none">정책</p>
            <ul className="mt-2 space-y-[0.225rem] text-muted sm:space-y-[0.3375rem]">
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
              <li>
                <Link href="/privacy" className="hover:text-ink">
                  개인정보처리방침
                </Link>
              </li>
            </ul>
          </div>
          <div className="min-w-0 text-[11px] leading-[0.9rem] sm:text-sm sm:leading-[1.35]">
            <p className="font-semibold leading-none">운영사</p>
            {/* Identical space-y / leading to 정책 so both columns share one rhythm. */}
            <ul className="mt-2 space-y-[0.225rem] text-muted sm:space-y-[0.3375rem]">
              <li className="leading-[inherit]">{SITE.companyShort}</li>
              <li className="leading-[inherit]">
                <span className="inline-flex flex-nowrap items-center gap-1.5 sm:gap-2">
                  <span className="whitespace-nowrap">
                    {SITE.name} ({SITE.nameKo})
                  </span>
                  <Link
                    href="/admin"
                    className="inline-flex h-[1em] shrink-0 items-center rounded-md border border-line bg-board px-1.5 text-[0.95em] font-medium leading-none text-ink hover:bg-panel"
                  >
                    {SITE.name} Admin
                  </Link>
                </span>
              </li>
              <li className="leading-[inherit]">{SITE.domain}</li>
              <li className="leading-[inherit]">
                <a href={`mailto:${SITE.contactEmail}`} className="break-all hover:text-ink">
                  {SITE.contactEmail}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center font-sans text-[11px] leading-5 text-muted">
        히트맵은 5분마다, 매거진은 매일 1회 갱신됩니다.
        <br />
        © {year} {SITE.companyShort} · {SITE.name} All rights reserved.
      </div>
    </footer>
  );
}
