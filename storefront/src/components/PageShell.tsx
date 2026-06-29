import { SiteFooter } from "./SiteFooter";
import { SiteHeader, ToolTabs, type ToolView } from "./SiteHeader";

export function PageShell({
  title,
  intro,
  eyebrow,
  wide,
  toolTabs,
  input,
  compact,
  toolView,
  onToolView,
  children,
}: {
  title?: string;
  intro?: React.ReactNode;
  eyebrow?: string;
  wide?: boolean;
  toolTabs?: boolean;
  input?: React.ReactNode;
  compact?: boolean;
  toolView?: ToolView;
  onToolView?: (view: ToolView) => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <main
        className={`flex flex-1 flex-col px-6 print:px-0 print:py-0 ${
          compact ? "pt-10 pb-20 md:pt-12 md:pb-28" : "py-20 md:py-28"
        }`}
      >
        <div className={`mx-auto w-full ${wide ? "max-w-[1400px]" : "max-w-[920px]"}`}>
          <div className="hidden print:mb-6 print:block print:border-b print:border-ink print:pb-3">
            <p className="font-display text-[24px] font-bold leading-none tracking-tight text-ink">
              Your Site
            </p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-soft" />
          </div>
          {eyebrow && (
            <div className="mb-8 flex items-center gap-4">
              <span className="label-eyebrow">{eyebrow}</span>
              <span className="h-px flex-1 bg-rule-strong" />
            </div>
          )}
          {title && (
            // Once a tool has output, the page is in "tool mode": collapse the big
            // marketing H1 to sr-only so it stops eating ~a third of the viewport,
            // while keeping it in the DOM for SEO and screen-reader navigation.
            <h1
              className={
                compact
                  ? "sr-only"
                  : "font-display text-[clamp(44px,7vw,96px)] font-black leading-[0.95] tracking-[-0.02em] text-ink print:text-[32px] print:leading-tight"
              }
            >
              {title}
            </h1>
          )}
          {toolTabs ? (
            // Tool pages: the description, the URL input, and the tool switcher
            // share one bold, bordered hero card so the whole entry point reads as
            // a single unit. All interactive chrome, so it is hidden in print. In
            // tool mode (compact) the marketing description drops out, leaving just
            // the input + switcher tight to the top.
            <div
              className={`${
                compact ? "mt-0" : "mt-10"
              } border-2 border-ochre bg-paper-deep p-5 md:p-7 print:hidden`}
            >
              {intro && !compact && (
                <p className="max-w-[680px] font-body text-[18px] italic leading-[1.65] text-ink-soft md:text-[20px]">
                  {intro}
                </p>
              )}
              {input && (
                <div className={intro && !compact ? "mt-6" : undefined}>{input}</div>
              )}
              <div className="mt-6 border-t border-rule-strong pt-5">
                <ToolTabs activeView={toolView} onSelectView={onToolView} />
              </div>
            </div>
          ) : (
            intro && (
              <p className="mt-8 max-w-[680px] font-body text-[18px] italic leading-[1.65] text-ink-soft md:text-[20px] print:hidden">
                {intro}
              </p>
            )
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
