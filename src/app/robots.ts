import { SITE } from "@/lib/site";
import type { MetadataRoute } from "next";

/**
 * Naver's crawler is Yeti — keep it explicitly allowed.
 * /search is noindex elsewhere; disallow here to save crawl budget.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/admin", "/search"],
      },
      {
        userAgent: "Yeti",
        allow: "/",
        disallow: ["/admin", "/api/admin", "/search"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
