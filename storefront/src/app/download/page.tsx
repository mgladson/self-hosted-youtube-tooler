import type { Metadata } from "next";
import { DownloadContent } from "@/components/DownloadContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Download",
  description:
    "Download any YouTube video at up to 4K, or extract just the audio as MP3.",
  path: "/download",
});

export default function DownloadPage() {
  return <DownloadContent />;
}
