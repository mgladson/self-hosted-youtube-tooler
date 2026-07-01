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

      <ApiKeysSection onNotice={setNotice} />

      <CreditsSection />

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

type ApiKey = {
  id: string;
  name: string | null;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

// Developer API keys: list the caller's active keys, mint a new one (the secret is
// shown exactly once), and revoke. All calls are same-origin with the session cookie;
// errors bubble up to the shared account notice.
function ApiKeysSection({ onNotice }: { onNotice: (msg: string | null) => void }) {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    fetch("/api/developer/api-keys", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { keys: [] }))
      .then((d: { keys?: ApiKey[] }) => setKeys(d.keys ?? []))
      .catch(() => setKeys([]));
  }, []);

  useEffect(() => load(), [load]);

  const create = useCallback(async () => {
    setBusy(true);
    onNotice(null);
    try {
      const res = await fetch("/api/developer/api-keys", { method: "POST", credentials: "include" });
      const body = (await res.json().catch(() => ({}))) as { secret?: string; error?: string };
      if (res.ok && body.secret) {
        setNewSecret(body.secret);
        setCopied(false);
        load();
      } else {
        onNotice(body.error || "Could not create a key. Please try again.");
      }
    } catch {
      onNotice("Could not create a key. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [load, onNotice]);

  const revoke = useCallback(
    async (id: string) => {
      setBusy(true);
      onNotice(null);
      try {
        const res = await fetch(`/api/developer/api-keys/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          onNotice(body.error || "Could not revoke the key.");
        }
        load();
      } catch {
        onNotice("Could not revoke the key.");
      } finally {
        setBusy(false);
      }
    },
    [load, onNotice],
  );

  const active = (keys ?? []).filter((k) => !k.revoked_at);

  return (
    <section className="mt-14 border-t border-rule pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow text-ink">Developer API</p>
          <p className="mt-1 max-w-[520px] font-body text-[14px] text-ink-soft">
            Keys authenticate the REST API. Read the{" "}
            <a href="/docs" className="text-ochre underline underline-offset-2 hover:text-ochre-deep">
              API docs
            </a>{" "}
            to get started.
          </p>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep disabled:opacity-50"
        >
          {busy ? "Working…" : "Create key"}
        </button>
      </div>

      {newSecret && (
        <div className="mt-6 border border-ochre bg-paper-warm p-4">
          <p className="label-eyebrow text-ink">Your new key — copy it now</p>
          <p className="mt-2 font-body text-[13px] text-ink-soft">
            This is the only time we will show it. Store it somewhere safe.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="break-all border border-rule bg-paper px-3 py-2 font-mono text-[13px] text-ink">
              {newSecret}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(newSecret).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
              className="border border-ink/60 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setNewSecret(null)}
              className="border border-ink/60 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        {keys === null ? (
          <p className="font-body text-[14px] italic text-ink-muted">Loading keys…</p>
        ) : active.length === 0 ? (
          <p className="font-body text-[14px] text-ink-muted">No API keys yet.</p>
        ) : (
          <ul className="divide-y divide-rule border border-rule">
            {active.map((k) => (
              <li
                key={k.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-mono text-[13px] text-ink">
                    {k.key_prefix}
                    <span className="text-ink-muted">…</span>
                    {k.name ? <span className="ml-2 text-ink-soft">({k.name})</span> : null}
                  </p>
                  <p className="mt-1 font-body text-[12px] text-ink-muted">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {" · "}
                    {k.last_used_at
                      ? `last used ${new Date(k.last_used_at).toLocaleDateString()}`
                      : "never used"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(k.id)}
                  disabled={busy}
                  className="border border-ink/60 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-crimson hover:text-crimson disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type LedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  balance_after: number;
  ref: string | null;
  created_at: string;
};

// API credit balance + recent ledger. Renders nothing until the account has a credit
// row (i.e. after the first key is created), so it stays quiet for non-developers.
function CreditsSection() {
  const [data, setData] = useState<{ balance: number; ledger: LedgerEntry[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/developer/credits", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { balance: number; ledger: LedgerEntry[] } | null) => setData(d))
      .catch(() => setData(null));
  }, []);

  const buy = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/developer/credits/checkout", {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      setErr(body.error || "Credit purchases aren't available just yet.");
    } catch {
      setErr("Credit purchases aren't available just yet.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Only surface credits once the account has engaged with the API (a key mints the
  // welcome grant), so casual account visitors don't see a developer billing widget.
  if (!data || (data.balance === 0 && data.ledger.length === 0)) return null;

  return (
    <section className="mt-14 border-t border-rule pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow text-ink">API credits</p>
          <p className="mt-2 font-mono text-[28px] text-ink">
            {data.balance}
            <span className="text-[16px] text-ink-muted"> credits</span>
          </p>
        </div>
        <button
          type="button"
          onClick={buy}
          disabled={busy}
          className="border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep disabled:opacity-50"
        >
          {busy ? "Starting…" : "Buy credits"}
        </button>
      </div>
      {err && (
        <div className="mt-4 border border-rule bg-paper-warm p-3 font-body text-[13px] text-ink-soft">
          {err}
        </div>
      )}
      {data.ledger.length > 0 && (
        <ul className="mt-6 divide-y divide-rule border border-rule">
          {data.ledger.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-body text-[13px] capitalize text-ink">
                  {e.reason.replace(/[:_]/g, " ")}
                </p>
                <p className="mt-1 font-body text-[12px] text-ink-muted">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`font-mono text-[14px] ${
                    e.delta >= 0 ? "text-ochre" : "text-ink-soft"
                  }`}
                >
                  {e.delta >= 0 ? "+" : ""}
                  {e.delta}
                </p>
                <p className="mt-1 font-mono text-[11px] text-ink-muted">bal {e.balance_after}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
