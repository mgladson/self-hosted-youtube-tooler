import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-rule-strong bg-paper-warm print:hidden">
      <div className="mx-auto w-full max-w-[1280px] px-6 pt-10 pb-6">
        <p className="mx-auto max-w-[860px] text-center font-body text-[12px] leading-[1.6] text-ink-muted">
          Disclaimer: Your Site is an independent service and is not associated or affiliated with YouTube or Google. Any brand names or logos displayed on this site are used for illustrative purposes only and do not imply endorsement or partnership.
        </p>
      </div>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-3 px-6 pb-10 text-[11px] font-mono uppercase tracking-[0.18em] text-ink-muted sm:flex-row sm:justify-between">
        <p>© Your Site · {new Date().getFullYear()} · All rights reserved</p>
        <div className="flex items-center gap-4 sm:mr-16">
          <Link href="/faq" className="transition-colors hover:text-ink">
            FAQ
          </Link>
          <span className="text-ochre" aria-hidden="true">
            ·
          </span>
          <Link
            href="/useful-links"
            className="transition-colors hover:text-ink"
          >
            Useful Links
          </Link>
          <span className="text-ochre" aria-hidden="true">
            ·
          </span>
          <Link
            href="/privacy-policy"
            className="transition-colors hover:text-ink"
          >
            Privacy
          </Link>
          <span className="text-ochre" aria-hidden="true">
            ·
          </span>
          <Link
            href="/terms-of-service"
            className="transition-colors hover:text-ink"
          >
            Terms
          </Link>
          <span className="text-ochre" aria-hidden="true">
            ·
          </span>
          <Link
            href="/refund-policy"
            className="transition-colors hover:text-ink"
          >
            Refunds
          </Link>
        </div>
      </div>
    </footer>
  );
}
