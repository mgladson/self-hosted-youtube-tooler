import type { Metadata } from "next";
import { TagsSeoContent } from "@/components/TagsSeoContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Tags & SEO",
  description:
    "Extract a YouTube video's tags and discover keyword ideas for your own titles, tags, and descriptions.",
  path: "/tags",
});

export default function TagsPage() {
  return <TagsSeoContent />;
}
