"use client";

import Link from "next/link";

// Raw error fields the API returns alongside a non-2xx response. `code` lets the
// UI react to specific failures (quota/rate-limit); the rest only arrive with a
// quota_exceeded body (see api entitlement.ts QuotaResult + youtube.ts route).
export interface ToolErrorBody {
  error?: string;
  code?: string;
  used?: number;
  limit?: number;
  resetAt?: string;
  upgrade?: boolean;
}

// The error shape the tool pages hold in state. Same fields as the body, but the
// human message is required (filled with a fallback when the body has none).
export interface ToolError {
  message: string;
  code?: string;
  used?: number;
  limit?: number;
  resetAt?: string;
  upgrade?: boolean;
}

export function toToolError(body: ToolErrorBody, status: number): ToolError {
  return {
    message: body.error || `Request failed (${status})`,
    code: body.code,
    used: body.used,
    limit: body.limit,
    resetAt: body.resetAt,
    upgrade: body.upgrade,
  };
}

// "Resets in 7 h" / "Resets in 12 min" from the ISO resetAt (next UTC midnight).
// Returns null when the timestamp is missing or already past.
function formatResetIn(resetAt?: string): string | null {
  if (!resetAt) return null;
  const diffMs = new Date(resetAt).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const mins = Math.ceil(diffMs / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.round(mins / 60)} h`;
}

// Shared error banner for the YouTube tools. Plain text for ordinary failures;
// for a daily-limit hit (quota_exceeded) it adds the used/limit count, when the
// pool resets, and an Upgrade button to the pricing page.
export function ToolErrorNotice({ error }: { error: ToolError }) {
  const isQuota = error.code === "quota_exceeded";
  const resetIn = formatResetIn(error.resetAt);
  const hasCount =
    typeof error.used === "number" && typeof error.limit === "number";

  return (
    <div className="mt-8 border border-crimson/60 bg-paper-warm p-5 font-body text-[15px] text-crimson">
      <p>{error.message}</p>

      {isQuota && (hasCount || resetIn) && (
        <p className="mt-1.5 text-[13px] text-ink-soft">
          {hasCount ? `Used ${error.used} of ${error.limit} today.` : null}
          {hasCount && resetIn ? " " : null}
          {resetIn ? `Resets in ${resetIn}.` : null}
        </p>
      )}

      {isQuota && error.upgrade && (
        <Link
          href="/pricing"
          className="mt-3 inline-flex items-center gap-2 border border-ochre bg-ochre px-4 py-2 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep"
        >
          Upgrade to Paid
          <span aria-hidden="true">&rarr;</span>
        </Link>
      )}
    </div>
  );
}
