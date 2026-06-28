import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader() {
  return (
    <header className="relative z-30 border-b border-rule-strong/40 print:hidden">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="font-display text-[24px] font-black tracking-tight text-ink sm:text-[28px]"
        >
          Your Site
        </Link>
        <nav className="flex items-center gap-6 font-display text-[16px] italic text-ink-soft">
          <Link href="/" className="transition-colors hover:text-ochre">
            Extractor
          </Link>
          <Link href="/thumbnails" className="transition-colors hover:text-ochre">
            Thumbnails
          </Link>
          <Link href="/tags" className="transition-colors hover:text-ochre">
            Tags
          </Link>
          <Link href="/download" className="transition-colors hover:text-ochre">
            Download
          </Link>
          <Link
            href="/useful-links"
            className="transition-colors hover:text-ochre"
          >
            Useful Links
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
