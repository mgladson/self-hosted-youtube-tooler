import type { Metadata } from "next";
import { FaqContent } from "@/components/FaqContent";
import { JsonLd } from "@/components/JsonLd";
import { DEFAULT_LOCALE, messages } from "@/lib/i18n";
import { breadcrumbSchema, buildMetadata, faqPageSchema } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "FAQ",
  description:
    "Frequently asked questions about extracting YouTube transcripts, thumbnails, tags, and downloading video or audio.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <JsonLd
        id="ld-faq-breadcrumbs"
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
        ])}
      />
      <JsonLd
        id="ld-faq"
        data={faqPageSchema(messages[DEFAULT_LOCALE].faq.items)}
      />
      <FaqContent />
    </>
  );
}
