"use client";

import { useTranslation } from "@/lib/i18n";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PageShell({
  title,
  intro,
  eyebrow,
  wide,
  children,
}: {
  title?: string;
  intro?: React.ReactNode;
  eyebrow?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <main className="flex flex-1 flex-col px-6 py-20 md:py-28 print:px-0 print:py-0">
        <div className={`mx-auto w-full ${wide ? "max-w-[1400px]" : "max-w-[920px]"}`}>
          <div className="hidden print:mb-6 print:block print:border-b print:border-ink print:pb-3">
            <p className="font-display text-[24px] font-bold leading-none tracking-tight text-ink">
              {t.nav.brandFull}
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft">
              {t.nav.brandTagline}
            </p>
          </div>
          {eyebrow && (
            <div className="mb-8 flex items-center gap-4">
              <span className="label-eyebrow">{eyebrow}</span>
              <span className="h-px flex-1 bg-rule-strong" />
            </div>
          )}
          {title && (
            <h1 className="font-display text-[clamp(44px,7vw,96px)] font-black leading-[0.95] tracking-[-0.02em] text-ink bea-display-h1 print:text-[32px] print:leading-tight">
              {title}
            </h1>
          )}
          {intro && (
            <p className="mt-8 max-w-[680px] font-body text-[18px] italic leading-[1.65] text-ink-soft md:text-[20px] print:hidden">
              {intro}
            </p>
          )}
          <div className="mt-10 text-ink-soft leading-relaxed font-body print:mt-4">{children}</div>
        </div>
      </main>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </>
  );
}
