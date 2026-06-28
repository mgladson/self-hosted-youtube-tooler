import type { Metadata } from "next";
import { YouTubeToolContent } from "@/components/YouTubeToolContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "YouTube Extractor",
  description:
    "Pull a YouTube video's transcript, title, description, tags, and thumbnail — fetched in your own browser, on your own IP.",
  path: "/",
});

export default function HomePage() {
  return <YouTubeToolContent />;
}
