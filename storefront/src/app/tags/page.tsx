import type { Metadata } from "next";
import { TagsSeoContent } from "@/components/TagsSeoContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "YouTube Tag Extractor & Keyword Tool",
  description:
    "See the hidden tags on any public YouTube video, check them against the 500-character limit, and get keyword ideas for your own titles, tags, and descriptions.",
  path: "/tags",
});

export default function TagsPage() {
  return <TagsSeoContent />;
}
