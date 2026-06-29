"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useViewerAuth } from "@/components/ViewerAuthProvider";

// Shared wrapper so every tool glyph renders at the same size and stroke. The
// icons are decorative (the visible label carries the meaning), so they are
// aria-hidden and removed from the focus/tab order.
function ToolIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="h-[17px] w-[17px] shrink-0"
    >
      {children}
    </svg>
  );
}

// The set of tools, shared by the header nav and the on-page ToolTabs switcher.
// `view` is the key the homepage uses for in-page switching; `href` is the
// standalone route the header (and ToolTabs in link mode) navigates to.
export type ToolView =
  | "overview"
  | "thumbnails"
  | "tags"
  | "download"
  | "transcript";

type Tool = {
  href: string;
  label: string;
  view: ToolView;
  icon: React.ReactNode;
};

// Tool switcher entries for the header nav, in display order. Each label names
// the thing you get back (Overview = the all-in-one breakdown, Video & Audio =
// the downloader) and pairs with a distinct glyph for at-a-glance scanning.
const TOOLS: Tool[] = [
  {
    href: "/",
    label: "Overview",
    view: "overview",
    icon: (
      <ToolIcon>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </ToolIcon>
    ),
  },
  {
    href: "/thumbnails",
    label: "Thumbnails",
    view: "thumbnails",
    icon: (
      <ToolIcon>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="1.4" />
        <path d="M21 15l-5-5L5 21" />
      </ToolIcon>
    ),
  },
  {
    href: "/tags",
    label: "Tags",
    view: "tags",
    icon: (
      <ToolIcon>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <path d="M7 7h.01" />
      </ToolIcon>
    ),
  },
  {
    href: "/download",
    label: "Video & Audio",
    view: "download",
    icon: (
      <ToolIcon>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M7 10l5 5 5-5" />
        <path d="M12 15V3" />
      </ToolIcon>
    ),
  },
  {
    href: "/transcript",
    label: "Transcript",
    view: "transcript",
    icon: (
      <ToolIcon>
        <path d="M4 6h16" />
        <path d="M4 10h16" />
        <path d="M4 14h12" />
        <path d="M4 18h9" />
      </ToolIcon>
    ),
  },
];

export function SiteHeader() {
  const pathname = usePathname();
  // Clicking a header link for the page you're already on does a soft
  // same-route navigation, which keeps client component state (e.g. the
  // extractor's typed URL and result). Force a clean reload so it resets.
  const resetIfSamePage =
    (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (pathname === href) {
        e.preventDefault();
        window.location.assign(href);
      }
    };
  return (
    <header className="relative z-30 border-b border-rule-strong/40 print:hidden">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-6 py-6">
        <div className="flex flex-col">
          <Link
            href="/"
            onClick={resetIfSamePage("/")}
            className="font-display text-[24px] font-black leading-none tracking-tight text-ink sm:text-[28px]"
          >
            Your Site
          </Link>
          <p className="mt-1 font-display text-[13px] italic text-ink-soft sm:text-[14px]">
            By youtubers, for youtubers
          </p>
        </div>
        <nav className="flex items-center gap-5 font-display text-[16px] text-ink-soft">
          {TOOLS.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={resetIfSamePage(href)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 transition-colors hover:text-ochre ${
                  active ? "text-ochre" : ""
                }`}
              >
                {icon}
                <span
                  className={
                    active
                      ? "underline decoration-2 underline-offset-[6px]"
                      : undefined
                  }
                >
                  {label}
                </span>
              </Link>
            );
          })}
          {/* Divider: tools on the left, the commercial/account links on the right. */}
          <span aria-hidden="true" className="h-4 w-px bg-rule-strong/40" />
          <Link
            href="/pricing"
            onClick={resetIfSamePage("/pricing")}
            aria-current={pathname === "/pricing" ? "page" : undefined}
            className={`transition-colors hover:text-ochre ${
              pathname === "/pricing"
                ? "text-ochre underline decoration-2 underline-offset-[6px]"
                : ""
            }`}
          >
            Pricing
          </Link>
          <ThemeToggle />
          <AccountControl />
        </nav>
      </div>
      {/* Bookmark hint bar, sits below the nav, still part of the header. */}
      <div className="border-t border-rule-strong/30 bg-paper-deep">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-center gap-x-2 gap-y-1 px-6 py-2.5 text-center font-body text-[13px] text-ink-soft sm:text-[14px]">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="h-[15px] w-[15px] shrink-0 text-ochre"
          >
            <path d="M6 2a2 2 0 0 0-2 2v18l8-5.6 8 5.6V4a2 2 0 0 0-2-2H6z" />
          </svg>
          <span>Finding this tool useful? Bookmark us</span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-[5px] border border-rule-strong bg-paper px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none text-ink shadow-sm">
              ctrl
            </kbd>
            <span className="text-ink-muted">+</span>
            <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-[5px] border border-rule-strong bg-paper px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none text-ink shadow-sm">
              d
            </kbd>
          </span>
          <span>for easy and fast access!</span>
        </div>
      </div>
    </header>
  );
}

// On-page tool switcher: the same TOOLS list as the header, rendered as a row of
// big tab buttons. PageShell places it inside the hero card on every tool page,
// below the description and URL input. It has two modes:
//   - Interactive (homepage): when given onSelectView, the tabs are <button>s
//     that switch the in-page view. Nothing navigates, so the typed URL and the
//     one-paste extraction survive — change tools without re-pasting.
//   - Link (standalone tool pages): with no handler, the tabs are <Link>s that
//     navigate to each focused, SEO-landing route; active = the current path.
export function ToolTabs({
  activeView,
  onSelectView,
}: {
  activeView?: ToolView;
  onSelectView?: (view: ToolView) => void;
} = {}) {
  const pathname = usePathname();
  const interactive = typeof onSelectView === "function";
  // Link mode only: a click on the link for the page you are already on would
  // soft-navigate and keep client state, so force a clean reload to reset.
  const resetIfSamePage =
    (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (pathname === href) {
        e.preventDefault();
        window.location.assign(href);
      }
    };
  const tabClass = (active: boolean) =>
    `flex flex-1 basis-[130px] items-center justify-center gap-2 border px-3 py-3 text-center font-mono text-[12px] uppercase tracking-[0.12em] transition-colors ${
      active
        ? "border-ochre bg-ochre text-paper"
        : "border-rule bg-paper text-ink-soft hover:border-ochre hover:text-ochre"
    }`;
  return (
    <nav aria-label="Choose a tool">
      <span className="label-eyebrow text-ochre">Pick a tool, switch anytime</span>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {TOOLS.map(({ href, label, icon, view }) => {
          const active = interactive ? activeView === view : pathname === href;
          if (interactive) {
            return (
              <button
                key={href}
                type="button"
                onClick={() => onSelectView!(view)}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              onClick={resetIfSamePage(href)}
              aria-current={active ? "page" : undefined}
              className={tabClass(active)}
            >
              {icon}
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Account / Google sign-in control for the header. Reads the viewer session
// from ViewerAuthProvider (mounted in the root layout, so the context is always
// available here). Signed out → a pill that starts the same-origin customer
// OAuth flow; signed in → an avatar + name with a sign-out menu.
function AccountControl() {
  const { user, loading } = useViewerAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click or Escape while it is open.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pillClass =
    "inline-flex items-center gap-2 whitespace-nowrap rounded-[6px] border border-ink/60 px-4 py-2 font-mono text-[12px] not-italic uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre";

  // While the session is resolving, reserve the pill's footprint (invisible) so
  // the nav does not shift when the real control swaps in.
  if (loading) {
    return (
      <span className={`${pillClass} opacity-0`} aria-hidden="true">
        My Account
      </span>
    );
  }

  if (!user) {
    // Full-page navigation into the same-origin OAuth flow. Caddy proxies
    // /api/* to the API, matching how ViewerAuthProvider reads /api/auth/me.
    // returnTo brings the visitor back to this page; without it the backend
    // redirects to /account, which the storefront has no route for.
    const returnTo = encodeURIComponent(pathname || "/");
    return (
      <a
        href={`/api/auth/customer/google?returnTo=${returnTo}`}
        className={pillClass}
        title="Sign in with Google"
      >
        My Account
      </a>
    );
  }

  const firstName = user.name?.trim().split(/\s+/)[0] || user.email;
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Fall through to a reload regardless so the UI re-syncs with the server.
    }
    window.location.reload();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={pillClass}
      >
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ochre text-[11px] font-bold text-paper"
        >
          {initial}
        </span>
        {firstName}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-56 rounded-[6px] border border-rule-strong bg-paper p-2 text-left shadow-lg"
        >
          <div className="border-b border-rule px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              Signed in as
            </p>
            <p
              className="truncate font-body text-[13px] not-italic text-ink"
              title={user.email}
            >
              {user.email}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="mt-1 w-full rounded-[4px] px-3 py-2 text-left font-mono text-[11px] not-italic uppercase tracking-[0.16em] text-ink-soft transition-colors hover:bg-paper-deep hover:text-ochre"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
