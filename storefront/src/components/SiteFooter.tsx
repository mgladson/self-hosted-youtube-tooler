import Link from "next/link";

// Footer link columns, each mapping to a real storefront route. Tools mirrors the
// header's tool switcher; Resources and Legal collect the standalone pages.
const TOOL_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/thumbnails", label: "Thumbnails" },
  { href: "/tags", label: "Tags" },
  { href: "/download", label: "Video & Audio" },
  { href: "/transcript", label: "Transcript" },
];

const RESOURCE_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/useful-links", label: "Useful Links" },
];

const LEGAL_LINKS = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
  { href: "/refund-policy", label: "Refund Policy" },
];

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h2 className="label-eyebrow text-ink-muted">{heading}</h2>
      <ul className="mt-4 space-y-3">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className="font-body text-[15px] text-ink-soft transition-colors hover:text-ochre"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-rule-strong bg-paper-warm print:hidden">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-8 lg:pr-20">
          {/* Brand: name + tagline (no logo or external links). */}
          <div>
            <p className="font-display text-[22px] font-black leading-none tracking-tight text-ink">
              Your Site
            </p>
            <p className="mt-2 font-display text-[14px] italic text-ink-soft">
              By youtubers, for youtubers
            </p>
          </div>
          {/* Non-affiliation disclaimer, its own column with an eyebrow header. */}
          <div>
            <h2 className="label-eyebrow text-ink-muted">Disclaimer</h2>
            <p className="mt-4 max-w-[38ch] font-body text-[12px] leading-[1.6] text-ink-muted">
              Your Site is an independent service and is not associated or affiliated with YouTube or Google. Any brand names or logos displayed on this site are used for illustrative purposes only and do not imply endorsement or partnership.
            </p>
          </div>
          <FooterColumn heading="Tools" links={TOOL_LINKS} />
          <FooterColumn heading="Resources" links={RESOURCE_LINKS} />
        </div>
      </div>

      {/* Copyright and legal links on one row, separated from the columns by a rule. */}
      <div className="border-t border-rule-strong/60">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center justify-center gap-x-6 gap-y-2 px-6 py-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted sm:flex-row">
          {/* The year is read at render time; server and client can disagree
              across a New Year / timezone boundary, so suppress that one mismatch
              (this footer hydrates — it is pulled in via PageShell from the
              "use client" content components). */}
          <p suppressHydrationWarning>
            © Your Site · {new Date().getFullYear()} · All rights reserved
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {LEGAL_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="transition-colors hover:text-ink"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
