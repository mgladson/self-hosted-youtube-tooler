"use client";

import { useEffect, useState } from "react";
import { PageShell } from "./PageShell";
import { useViewerAuth } from "./ViewerAuthProvider";

// Maps the ?error codes the API's OAuth callback redirects here with into
// human-readable copy.
const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Your sign-in session expired. Please try again.",
  oauth_denied: "Sign-in was cancelled.",
  oauth_failed: "Sign-in failed. Please try again.",
  no_email: "Google didn't share an email for that account.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
};

export function LoginContent() {
  const { user, loading } = useViewerAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(ERROR_MESSAGES[code] || "Sign-in failed. Please try again.");
  }, []);

  return (
    <PageShell
      title="Sign in"
      intro="Sign in with Google to raise your daily limits and manage your plan."
    >
      {error && (
        <div className="mb-8 border border-crimson/60 bg-paper-warm p-5 font-body text-[15px] text-crimson">
          {error}
        </div>
      )}

      {!loading && user ? (
        <p className="font-body text-[16px] text-ink-soft">
          You&rsquo;re already signed in as <span className="text-ink">{user.email}</span>.{" "}
          <a href="/account" className="text-ochre-deep underline hover:text-ochre">
            Go to your account
          </a>
          .
        </p>
      ) : (
        <a
          href="/api/auth/customer/google?returnTo=/account"
          className="inline-flex items-center gap-3 border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep"
        >
          Sign in with Google
        </a>
      )}

      <div className="mt-12 max-w-[560px] border-t border-rule pt-8 font-body text-[14px] leading-[1.7] text-ink-muted">
        <p>
          <span className="text-ink-soft">Free</span>: thumbnails, tags, and transcripts, plus
          audio and up to 720p downloads, with a generous daily limit.
        </p>
        <p className="mt-3">
          <span className="text-ink-soft">Pro</span>: 1080p and 4K downloads, far higher daily
          limits, and priority processing.
        </p>
      </div>
    </PageShell>
  );
}
