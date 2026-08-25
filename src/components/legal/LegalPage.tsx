import Link from "next/link";
import type { ReactNode } from "react";
import { SITE } from "@/lib/site";

const LEGAL_LINKS = [
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
  { href: "/disclaimer", label: "면책조항" },
  { href: "/contact", label: "문의하기" },
] as const;

export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="font-mono text-xs text-accent">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">
          시행일 {updated} · 운영 {SITE.companyShort} · {SITE.name} ({SITE.nameKo})
        </p>
        <p className="mt-1 text-sm text-muted">
          운영 이메일:{" "}
          <a href={`mailto:${SITE.contactEmail}`} className="text-accent hover:underline">
            {SITE.contactEmail}
          </a>
        </p>
      </header>
      <div className="space-y-8 text-[15px] leading-8">{children}</div>
      <LegalNav />
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function LegalNav() {
  return (
    <nav aria-label="정책 문서" className="border-t border-line pt-6 text-sm">
      <p className="text-muted">
        문의는{" "}
        <a href={`mailto:${SITE.contactEmail}`} className="text-accent hover:underline">
          {SITE.contactEmail}
        </a>
        로 보내 주십시오.
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-muted">
        {LEGAL_LINKS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="hover:text-ink">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
