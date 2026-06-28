import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PrivacyPolicyContent } from "@/components/PrivacyPolicyContent";
import { breadcrumbSchema, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How we collect, use, and protect your personal information.",
  path: "/privacy-policy",
  noIndex: true,
});

export default function PrivacyPolicyPage() {
  return (
    <>
      <JsonLd
        id="ld-privacy-breadcrumbs"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Privacy Policy", path: "/privacy-policy" },
        ])}
      />
      <PrivacyPolicyContent />
    </>
  );
}
