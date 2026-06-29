import type { Metadata } from "next";
import { TranscriptContent } from "@/components/TranscriptContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Free YouTube Transcript Generator",
  description:
    "Get a clean, copyable transcript of any public YouTube video in seconds. Read it as plain text or with timestamps, then export to TXT, Markdown, or SRT.",
  path: "/transcript",
});

export default function TranscriptPage() {
  return <TranscriptContent />;
}
