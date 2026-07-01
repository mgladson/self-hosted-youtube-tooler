import type { Metadata } from "next";
import { ThumbnailStudioContent } from "@/components/ThumbnailStudioContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "YouTube Thumbnail Grabber",
  description:
    "Grab every thumbnail from any public YouTube video: max-res up to 1280x720, plus HQ, SD, and auto-extracted frame grabs. Copy the URL or save the image.",
  path: "/thumbnails",
});

export default function ThumbnailsPage() {
  return <ThumbnailStudioContent />;
}
