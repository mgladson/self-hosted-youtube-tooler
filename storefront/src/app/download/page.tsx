import type { Metadata } from "next";
import { DownloadContent } from "@/components/DownloadContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Video & Audio Export: YouTube, Vimeo, TikTok & More",
  description:
    "Export the video or audio track from a public link on YouTube, Vimeo, TikTok, and more: MP4 up to 4K or MP3 audio, prepared on the server with nothing to install.",
  path: "/download",
});

export default function DownloadPage() {
  return <DownloadContent />;
}
