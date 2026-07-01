"use client";

import Link from "next/link";
import { PageShell } from "./PageShell";
import { useViewerAuth } from "./ViewerAuthProvider";

// Placeholder prices: set your final numbers here (and create the matching Stripe
// Prices for STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_ANNUAL in Slice 2). The
// annual per-month figure and the savings badge are derived from these two numbers.
const MONTHLY_PRICE = 10; // USD / month, billed monthly
const ANNUAL_PRICE_PER_MONTH = 8; // USD / month, billed annually
const ANNUAL_PRICE_YEARLY = ANNUAL_PRICE_PER_MONTH * 12; // USD billed once per year
const ANNUAL_SAVINGS_PCT = Math.round((1 - ANNUAL_PRICE_PER_MONTH / MONTHLY_PRICE) * 100);

type Compute = "browser" | "server";
type Row = {
  label: string;
  compute: Compute;
  free: boolean;
  pro: boolean;
  freeNote?: string;
  proNote?: string;
};

// `compute` = where the work runs. "browser" = on the visitor's own machine, free to
// us: thumbnails from YouTube's CDN, and title/description/tags/keywords/metadata from a
// single CORS-enabled YouTube Data API call. "server" = our yt-dlp/ffmpeg backend, only
// the two things YouTube blocks from the browser: transcripts and media downloads.
const ROWS: Row[] = [
  { label: "Thumbnails: every size, frame grabs, copy & download", compute: "browser", free: true, pro: true, freeNote: "Unlimited", proNote: "Unlimited" },
  { label: "Metadata (Title, Description, Tags & keywords)", compute: "browser", free: true, pro: true, freeNote: "25 / day", proNote: "Unlimited" },
  { label: "Transcripts: view, copy, TXT / MD / SRT", compute: "server", free: true, pro: true, freeNote: "25 / day", proNote: "Unlimited" },
  { label: "Audio (MP3) & up to 720p downloads", compute: "server", free: true, pro: true, freeNote: "3 / day", proNote: "Unlimited" },
  { label: "HD downloads: 1080p, 1440p & 4K", compute: "server", free: false, pro: true },
  { label: "Unlimited daily downloads", compute: "server", free: false, pro: true },
  { label: "Playlist batch: metadata, tags, thumbnails & transcripts", compute: "server", free: false, pro: true },
  { label: "Priority processing: no throttling", compute: "server", free: false, pro: true },
];

function Check() {
  return (
    <svg
      className="mx-auto h-[22px] w-[22px] text-ochre-deep"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Included"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg
      className="mx-auto h-[18px] w-[18px] text-crimson"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Not included"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// One Free/Paid cell: the check or cross, with an optional limit line under it
// (e.g. "25 / day", "Unlimited"). Notes only appear on the metered rows.
function MarkCell({ included, note }: { included: boolean; note?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {included ? <Check /> : <Cross />}
      {note ? (
        <span className="font-mono text-[14px] text-ink-soft">{note}</span>
      ) : null}
    </div>
  );
}

function StripeNote() {
  return (
    <p className="mt-5 flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">
      <svg
        className="h-2.5 w-2.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      Secure checkout by Stripe
    </p>
  );
}

export function PricingContent() {
  const { plan } = useViewerAuth();
  const isPro = plan === "pro";

  return (
    <PageShell
      title="Pricing"
      intro="Every tool is free to use, no account needed. Upgrade to the Paid plan to unlock HD &amp; 4K downloads and drop the daily limits."
      wide
    >
      <div className="mx-auto max-w-[760px] overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr className="border-b border-rule-strong/50">
              <th className="py-4 pr-4 text-left font-mono text-[16px] uppercase tracking-[0.16em] text-ink-muted">
                Feature
              </th>
              <th className="w-28 px-3 py-4 text-center font-mono text-[16px] uppercase tracking-[0.16em] text-ink-muted">
                Compute
              </th>
              <th className="w-28 px-3 py-4 text-center font-mono text-[16px] uppercase tracking-[0.16em] text-ink-soft">
                Free
              </th>
              <th className="w-28 bg-paper-warm px-3 py-4 text-center font-mono text-[17px] uppercase tracking-[0.16em] text-ochre-deep">
                Paid
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-b border-rule">
                <td className="py-3.5 pr-4 font-body text-[19px] leading-snug text-ink-soft">{r.label}</td>
                <td className="px-3 py-3.5 text-center">
                  <span
                    className={`font-mono text-[15px] uppercase tracking-[0.12em] ${
                      r.compute === "browser" ? "text-ochre-deep" : "text-ink-muted"
                    }`}
                  >
                    {r.compute === "browser" ? "Browser" : "Server"}
                  </span>
                </td>
                <td className="px-3 py-3.5 text-center">
                  <MarkCell included={r.free} note={r.freeNote} />
                </td>
                <td className="bg-paper-warm px-3 py-3.5 text-center">
                  <MarkCell included={r.pro} note={r.proNote} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mx-auto mt-10 max-w-[760px] text-center">
        {isPro ? (
          <p className="font-body text-[16px] text-ink-soft">
            You&rsquo;re on the Paid plan, thank you.{" "}
            <Link href="/account" className="text-ochre-deep underline hover:text-ochre">
              Manage your plan
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="mx-auto grid max-w-[760px] gap-8 text-left sm:grid-cols-2 sm:gap-6">
              <div className="flex flex-col border border-rule bg-paper p-8 sm:p-10">
                <p className="font-mono text-[15px] uppercase tracking-[0.18em] text-ink-soft">Monthly</p>
                <p className="mt-6">
                  <span className="font-body text-[42px] font-semibold leading-none text-ink">${MONTHLY_PRICE.toFixed(2)}</span>
                  <span className="font-body text-[17px] text-ink-muted"> /month</span>
                </p>
                <Link
                  href="/account?plan=monthly"
                  className="mt-6 inline-flex items-center justify-center border border-ochre px-6 py-3.5 font-mono text-[14px] uppercase tracking-[0.18em] text-ochre-deep transition-colors hover:bg-ochre hover:text-paper sm:mt-auto"
                >
                  Choose monthly
                </Link>
                <StripeNote />
              </div>

              <div className="relative flex flex-col border border-ochre bg-paper-warm p-8 sm:p-10">
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap bg-ochre px-3 py-1 font-mono text-[12px] uppercase tracking-[0.16em] text-paper">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Best value
                </span>
                <p className="font-mono text-[15px] uppercase tracking-[0.18em] text-ink-soft">Annual</p>
                <p className="mt-6">
                  <span className="font-body text-[42px] font-semibold leading-none text-ink">${ANNUAL_PRICE_PER_MONTH.toFixed(2)}</span>
                  <span className="font-body text-[17px] text-ink-muted"> /month</span>
                </p>
                <p className="mt-1 mb-6 font-body text-[16px] text-ink-muted">
                  Billed ${ANNUAL_PRICE_YEARLY.toFixed(2)}/year ·{" "}
                  <span className="font-medium text-ochre-deep">Save {ANNUAL_SAVINGS_PCT}%</span>
                </p>
                <Link
                  href="/account?plan=annual"
                  className="mt-auto inline-flex items-center justify-center border border-ochre bg-ochre px-6 py-3.5 font-mono text-[14px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep"
                >
                  Choose annual
                </Link>
                <StripeNote />
              </div>
            </div>

            <p className="mt-8 font-body text-[13px] italic text-ink-muted">
              Free stays free, forever. No account required.
            </p>
          </>
        )}
      </div>

      <p className="mx-auto mt-10 max-w-[760px] font-body text-[13px] italic leading-[1.7] text-ink-muted">
        Free includes 25 lookups and 3 downloads per day. A &ldquo;lookup&rdquo; is one new
        video&rsquo;s metadata, tags or transcript, charged once per video per day, and only the first
        time (re-opening a video you&rsquo;ve already fetched is free). Thumbnails never count.
      </p>
    </PageShell>
  );
}
