import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SITE } from "@/lib/site";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  // Homepage LCP is Pretendard text — do not preload mono on every document.
  preload: false,
  adjustFontFallback: true,
});

/** Pin serverless execution to Seoul (icn1). Mirrors vercel.json `regions`. */
export const preferredRegion = "icn1";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "KinDex",
    "킨덱스",
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
const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${jetbrainsMono.variable} h-full`}
    >
      <head>
        {/*
         * Pretendard stays the brand face, but a render-blocking CDN stylesheet
         * owned FCP/LCP. Preconnect + non-blocking load lets system fallbacks
         * paint first; Pretendard swaps in with font-display from the CSS.
         */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="preload" as="style" href={PRETENDARD_CSS} />
        <link rel="stylesheet" href={PRETENDARD_CSS} media="print" id="font-pretendard" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=document.getElementById('font-pretendard');if(!l)return;var apply=function(){l.media='all'};if(l.addEventListener)l.addEventListener('load',apply);l.onload=apply;setTimeout(apply,2500);})();`,
          }}
        />
        <noscript>
          <link rel="stylesheet" href={PRETENDARD_CSS} />
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark';var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-board font-sans text-ink antialiased">
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
        <script
          type="application/ld+json"
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
