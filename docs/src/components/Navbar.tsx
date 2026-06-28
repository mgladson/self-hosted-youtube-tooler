"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { label: "Guides", href: "/getting-started" },
  { label: "Platform", href: "/platform-overview" },
  { label: "API Reference", href: "/api-reference" },
  { label: "Security", href: "/security" },
  { label: "Integrations", href: "/integrations" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[60px] bg-doc-navbar border-b border-doc-navbar-border flex items-center pl-14 lg:pl-6 pr-4 lg:pr-6">
      <div className="flex items-center gap-3 mr-8 shrink-0">
        <div className="w-8 h-8 bg-doc-active-border rounded-lg flex items-center justify-center">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
        <Link
          href="/"
          className="text-[15px] font-semibold text-doc-heading hover:text-doc-link transition-colors"
        >
          StackDocs
        </Link>
      </div>

      <div className="hidden md:flex items-center gap-1">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 text-[14px] rounded-md transition-colors ${
                isActive
                  ? "text-doc-link font-medium bg-doc-active-bg"
                  : "text-doc-text-muted hover:text-doc-text hover:bg-gray-50"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative hidden sm:block">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search coming soon..."
            readOnly
            className="w-[200px] lg:w-[260px] pl-9 pr-3 py-1.5 text-[14px] border border-doc-border rounded-lg bg-doc-sidebar outline-none cursor-default placeholder:text-gray-400"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 bg-white border border-doc-border rounded px-1.5 py-0.5 font-mono">
            /
          </kbd>
        </div>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-doc-text-muted hover:text-doc-text transition-colors p-1.5"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
      </div>
    </nav>
  );
}
