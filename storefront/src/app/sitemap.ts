import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

const lastModified = new Date();

// Indexable routes only. noindex pages are intentionally excluded:
//   /login, /account                                   (auth/utility)
//   /privacy-policy, /terms-of-service, /refund-policy  (legal)
const routes: {
  path: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
}[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/transcript", changeFrequency: "weekly", priority: 0.9 },
  { path: "/thumbnails", changeFrequency: "weekly", priority: 0.9 },
  { path: "/download", changeFrequency: "weekly", priority: 0.9 },
  { path: "/tags", changeFrequency: "weekly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.7 },
  { path: "/useful-links", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
