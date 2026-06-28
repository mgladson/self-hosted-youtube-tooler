import type { Metadata } from "next";
import { UsefulLinksContent } from "@/components/UsefulLinksContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Useful Links",
  description:
    "A short list of outside tools that pair well with the extractor — for compressing thumbnails and pulling background music.",
  path: "/useful-links",
});

export default function UsefulLinksPage() {
  return <UsefulLinksContent />;
}
