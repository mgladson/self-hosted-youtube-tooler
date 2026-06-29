import type { Metadata } from "next";
import { PricingContent } from "@/components/PricingContent";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Pricing",
  description: "Free and Pro plans for the YouTube toolkit: see what each tier includes, side by side.",
  path: "/pricing",
});

export default function PricingPage() {
  return <PricingContent />;
}
