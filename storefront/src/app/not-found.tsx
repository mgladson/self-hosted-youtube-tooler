import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Page Not Found",
  description: "The page you are looking for cannot be found.",
  path: "/404",
  noIndex: true,
});

export default function NotFound() {
  return (
    <PageShell title="404" intro="The page you are looking for cannot be found.">
      <Link
        href="/"
        className="font-display text-[18px] italic text-ochre transition-colors hover:underline"
      >
        Return home
      </Link>
    </PageShell>
  );
}
