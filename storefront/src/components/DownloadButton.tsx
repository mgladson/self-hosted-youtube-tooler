"use client";

import Link from "next/link";
import { useViewerAuth } from "./ViewerAuthProvider";

// Qualities reserved for the Paid plan. Mirrors FREE_DOWNLOAD_QUALITIES in the API's
// entitlement.ts (audio and up to 720p are free for everyone; 1080p+ is paid).
const PAID_QUALITIES = new Set(["1080", "1440", "2160"]);

const PRIMARY =
  "border border-ochre bg-ochre px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-paper transition-colors hover:bg-ochre-deep";
const SECONDARY =
  "inline-block border border-rule px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre";

// A download control that reflects the viewer's plan: basic quality streams for
// everyone (no sign-in); HD/4K routes a non-Supporter to the pricing page instead
// of letting the click land on the API's raw 402 JSON.
export function DownloadButton({
  href,
  label,
  quality,
  variant = "primary",
}: {
  href: string;
  label: string;
  quality: string;
  variant?: "primary" | "secondary";
}) {
  const { plan, loading } = useViewerAuth();
  const cls = variant === "secondary" ? SECONDARY : PRIMARY;

  if (loading) {
    return (
      <span className={`${cls} cursor-default opacity-50`} aria-hidden="true">
        {label}
      </span>
    );
  }

  if (plan !== "pro" && PAID_QUALITIES.has(quality)) {
    return (
      <Link href="/pricing" className={cls} title="Upgrade for HD & 4K downloads">
        {label} · Paid
      </Link>
    );
  }

  return (
    <a href={href} download className={cls}>
      {label}
    </a>
  );
}
