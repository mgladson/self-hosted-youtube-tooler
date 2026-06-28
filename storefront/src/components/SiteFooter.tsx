import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-rule-strong bg-paper-warm print:hidden">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-3 px-6 py-10 text-[11px] font-mono uppercase tracking-[0.18em] text-ink-muted sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Your Site</p>
        <div className="flex items-center gap-4">
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
        </div>
      </div>
    </footer>
  );
}
