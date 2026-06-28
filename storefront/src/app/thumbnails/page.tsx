import type { Metadata } from "next";
import { ThumbnailStudioContent } from "@/components/ThumbnailStudioContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Thumbnail Grabber",
  description:
    "Download every thumbnail resolution from any YouTube video — max-res, HQ, SD, and frame grabs.",
  path: "/thumbnails",
});

export default function ThumbnailsPage() {
  return <ThumbnailStudioContent />;
}
