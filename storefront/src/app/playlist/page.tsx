import type { Metadata } from "next";
import { PlaylistContent } from "@/components/PlaylistContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "YouTube Playlist Batch: Transcripts, Tags & Metadata",
  description:
    "Process an entire YouTube playlist in one pass: pull the metadata, tags, thumbnails, and transcript for every video, then download the whole set as a report bundle.",
  path: "/playlist",
});

export default function PlaylistPage() {
  return <PlaylistContent />;
}
