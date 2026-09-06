import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 blocks cross-origin `/_next/*` in dev (403). Cursor Cloud previews
  // hit the app through proxied hosts (and sometimes sandboxed iframes that send
  // `Origin: null`), so those sources must be allowlisted or HTML loads while
  // JS/CSS fail and the UI looks stuck. `**` matches nested subdomains.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "**.cursorusercontent.com",
    "**.cursor.sh",
    "**.portless.dev",
    "null",
  ],
  async headers() {
    return [
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/_next/static/:path*",
              headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
            },
          ]
        : []),
      {
        /*
         * Files served straight from `public/`. These have no hash in their
         * name, so they cannot be immutable — a day at the edge with a week of
         * stale-while-revalidate keeps repeat visits instant while still letting
         * a replacement roll out without a rename.
         */
        source: "/:file*.(svg|png|jpg|jpeg|webp|avif|gif|ico|woff|woff2|ttf|otf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Debug-Marker", value: "probe-9f81" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/board/us-stock-trend-index",
        destination: "/board/kospi-fomo-index",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "plus.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "image-comic.pstatic.net", pathname: "/**" },
      { protocol: "https", hostname: "kr-a.kakaopagecdn.com", pathname: "/**" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/**" },
      { protocol: "https", hostname: "is1-ssl.mzstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "is2-ssl.mzstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "is3-ssl.mzstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "is4-ssl.mzstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "is5-ssl.mzstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.akamai.steamstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "shared.akamai.steamstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "steamcdn-a.akamaihd.net", pathname: "/**" },
      { protocol: "https", hostname: "image.api.playstation.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
