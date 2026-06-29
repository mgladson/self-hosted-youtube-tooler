import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { RefundPolicyContent } from "@/components/RefundPolicyContent";
import { breadcrumbSchema, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Refund Policy",
  description:
    "When fees for an optional paid subscription can be refunded, and how to request one.",
  path: "/refund-policy",
  noIndex: true,
});

export default function RefundPolicyPage() {
  return (
    <>
      <JsonLd
        id="ld-refund-breadcrumbs"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Refund Policy", path: "/refund-policy" },
        ])}
      />
      <RefundPolicyContent />
    </>
  );
}
