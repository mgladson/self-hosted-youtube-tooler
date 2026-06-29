import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /_next/ is intentionally NOT blocked: it serves the CSS and JS
        // Googlebot needs to render the page.
        disallow: [
          "/api/",
          "/admin/",
          "/private/",
          "/preview/",
          "/*?preview=*",
          "/*?draft=*",
        ],
      },
      {
        userAgent: ["GPTBot", "Google-Extended", "PerplexityBot", "ClaudeBot", "anthropic-ai", "CCBot", "Bytespider"],
        allow: "/",
        disallow: ["/api/", "/admin/", "/private/", "/preview/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
