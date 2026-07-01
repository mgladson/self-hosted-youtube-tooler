import type { Metadata } from "next";
import { DocsContent } from "@/components/DocsContent";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "API Documentation",
  description:
    "REST API for YouTube transcripts, metadata, formats, thumbnails, and downloads. Authenticate with an API key and pay per successful call in credits.",
  path: "/api-docs",
});

export default function ApiDocsPage() {
  return (
    <>
      <JsonLd
        id="ld-api-docs-breadcrumbs"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "API Docs", path: "/api-docs" },
        ])}
      />
      <DocsContent />
    </>
  );
}
