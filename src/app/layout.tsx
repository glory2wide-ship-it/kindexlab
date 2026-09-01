import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SITE } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "KindexLab",
    "킨덱스랩",
    "kindexlab.com",
    "화제성 순위",
    "셀럽 랭킹",
    "예능 순위",
    "K-POP",
    "음원 차트",
    "시청률",
    "웹툰",
    "네이버웹툰",
    "숏폼",
    "틱톡",
    "유튜브 인기",
    "모바일 게임",
    "스팀",
    "콘솔 게임",
    "맛집",
    "여행",
    "레져",
    "트리맵",
    "버즈 지수",
  ],
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} · ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} · ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": `${SITE.url}/feed.xml` },
  },
  other: {
    "application-name": SITE.name,
  },
};

const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${notoSansKr.variable} h-full`}
    >
      <head>
        {/*
         * Pretendard is the brand face, so its stylesheet stays render-blocking —
         * swapping it in late would reflow every heading. The preconnect is what
         * makes that affordable: DNS, TCP and TLS to the CDN start with the
         * document instead of after the parser reaches this tag.
         *
         * The Noto Sans KR stylesheet that used to sit here was a second blocking
         * cross-origin request for a face that only ever applied if Pretendard
         * failed. `system-ui` already resolves to a Korean face on every target
         * platform (Malgun Gothic, Apple SD Gothic Neo, Noto Sans CJK), so the
         * family name is kept in the stack for locally installed copies and the
         * network request is gone.
         */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-full flex-col bg-board font-sans text-ink antialiased">
        <Script id="theme-boot" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`}
        </Script>
        {/*
         * Ads load after the page is idle. `afterInteractive` puts the AdSense
         * bundle in contention with hydration, and it is a large script that
         * spawns further requests — on a mid-range phone that lands squarely on
         * INP and TBT. Nothing above the fold depends on it.
         */}
        {adsenseClient ? (
          <Script
            id="adsense"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
            strategy="lazyOnload"
          />
        ) : null}
        <Script
          id="website-jsonld"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE.name,
              alternateName: SITE.nameKo,
              url: SITE.url,
              email: SITE.contactEmail,
              publisher: {
                "@type": "Organization",
                name: SITE.company,
                email: SITE.contactEmail,
              },
            }),
          }}
        />
        <ThemeProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-7xl px-4 py-4">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
