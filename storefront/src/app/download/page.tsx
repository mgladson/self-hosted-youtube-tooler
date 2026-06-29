import type { Metadata } from "next";
import { DownloadContent } from "@/components/DownloadContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Free YouTube Video Downloader",
  description:
    "Download any public YouTube video as MP4 at up to 4K, or save just the audio as an MP3. Files are prepared on the server, with no software to install.",
  path: "/download",
});

export default function DownloadPage() {
  return <DownloadContent />;
}
