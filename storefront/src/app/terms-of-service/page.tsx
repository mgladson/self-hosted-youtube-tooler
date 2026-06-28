import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { TermsOfServiceContent } from "@/components/TermsOfServiceContent";
import { breadcrumbSchema, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description:
    "The terms governing your use of this site and our services.",
  path: "/terms-of-service",
  noIndex: true,
});

export default function TermsOfServicePage() {
  return (
    <>
      <JsonLd
        id="ld-terms-breadcrumbs"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Terms of Service", path: "/terms-of-service" },
        ])}
      />
      <TermsOfServiceContent />
    </>
  );
}
