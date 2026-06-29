"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "./PageShell";

type Usage = { used: number; limit: number };
type MeResponse = {
  user: { email: string; name: string; role: string } | null;
  subscription?: { plan: "free" | "pro" };
  usage?: { lookups: Usage; downloads: Usage };
};

export function AccountContent() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((d: MeResponse) => setData(d))
      .catch(() => setData({ user: null }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  // Honor a ?plan=monthly|annual hint from the pricing page so the chosen interval
  // carries over. Read post-mount (not during render) to avoid a hydration mismatch.
  useEffect(() => {
    const plan = new URLSearchParams(window.location.search).get("plan");
    if (plan === "monthly" || plan === "annual") setBillingInterval(plan);
  }, []);

  // Both billing actions live in Slice 2; until then the endpoints 404/401 and we
  // surface a friendly notice instead of breaking.
  const startBilling = useCallback(async (path: string, fallback: string, payload?: unknown) => {
    setBusy(true);
    setNotice(null);
    try {
      // Only attach a JSON body (and Content-Type) when there is one: the portal call
      // posts nothing, and an empty body under a JSON Content-Type makes Fastify 400.
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        ...(payload === undefined
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      setNotice(body.error || fallback);
    } catch {
      setNotice(fallback);
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // navigate home regardless so the UI re-syncs with the server
    }
    window.location.href = "/";
  }, []);

  if (loading) {
    return (
      <PageShell title="Account">
        <p className="font-body text-[16px] italic text-ink-muted">Loading…</p>
      </PageShell>
    );
  }

  if (!data?.user) {
    return (
      <PageShell title="Account" intro="Sign in to see your plan and daily usage.">
        <a
          href="/api/auth/customer/google?returnTo=/account"
          className="inline-flex items-center gap-3 border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep"
        >
          Sign in with Google
        </a>
      </PageShell>
    );
  }

  const isPro = (data.subscription?.plan ?? "free") === "pro";
  const { lookups, downloads } = data.usage ?? {};

  return (
    <PageShell title="Account">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label-eyebrow text-ink">Signed in as</p>
          <p className="mt-1 font-body text-[16px] text-ink">{data.user.email}</p>
        </div>
        <span
          className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] ${
            isPro ? "border-ochre bg-ochre text-paper" : "border-rule text-ink-soft"
          }`}
        >
          {isPro ? "Paid" : "Free"} plan
        </span>
      </div>

      {(lookups || downloads) && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {lookups && <UsageCard label="Lookups today" usage={lookups} />}
          {downloads && <UsageCard label="Downloads today" usage={downloads} />}
        </div>
      )}

      {notice && (
        <div className="mt-8 border border-rule bg-paper-warm p-4 font-body text-[14px] text-ink-soft">
          {notice}
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-4">
        {isPro ? (
          <button
            type="button"
            onClick={() => startBilling("/api/billing/create-portal-session", "Billing management isn't available just yet.")}
            disabled={busy}
            className="border border-ink/60 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre disabled:opacity-50"
          >
            Manage billing
          </button>
        ) : (
          <>
            <div className="inline-flex border border-rule" role="group" aria-label="Billing interval">
              {(["monthly", "annual"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setBillingInterval(opt)}
                  aria-pressed={billingInterval === opt}
                  className={`px-4 py-3 font-mono text-[12px] uppercase tracking-[0.18em] transition-colors ${
                    billingInterval === opt ? "bg-ochre text-paper" : "text-ink-soft hover:text-ochre"
                  }`}
                >
                  {opt === "annual" ? "Annual" : "Monthly"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                startBilling(
                  "/api/billing/create-checkout-session",
                  "Upgrades aren't available just yet. Please check back soon.",
                  { interval: billingInterval },
                )
              }
              disabled={busy}
              className="border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep disabled:opacity-50"
            >
              {busy ? "Starting…" : `Upgrade · ${billingInterval === "annual" ? "Annual" : "Monthly"}`}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={signOut}
          className="border border-ink/60 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
        >
          Sign out
        </button>
      </div>
    </PageShell>
  );
}

function UsageCard({ label, usage }: { label: string; usage: Usage }) {
  const pct = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  return (
    <div className="border border-rule p-5">
      <p className="label-eyebrow text-ink">{label}</p>
      <p className="mt-2 font-mono text-[20px] text-ink">
        {usage.used}
        <span className="text-ink-muted"> / {usage.limit}</span>
      </p>
      <div className="mt-3 h-1.5 w-full bg-paper-deep">
        <div className="h-full bg-ochre" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
