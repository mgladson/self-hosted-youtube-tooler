import type { Metadata } from "next";
import { YouTubeToolContent } from "@/components/YouTubeToolContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "YouTube Transcript, Downloader & Thumbnail Tools",
  description:
    "Pull a YouTube video's transcript, title, description, tags, and thumbnail, plus video and audio downloads, in a single paste. No account required.",
  path: "/",
});

export default function HomePage() {
  return <YouTubeToolContent />;
}
