import { SITE } from "@/lib/site";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/admin", "/search"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
