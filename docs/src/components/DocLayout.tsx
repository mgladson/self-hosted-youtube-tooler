"use client";

import Link from "next/link";
import TableOfContents, { TocItem } from "./TableOfContents";

interface DocLayoutProps {
  title: string;
  description: string;
  breadcrumb: string;
  toc: TocItem[];
  prev?: { label: string; href: string };
  next?: { label: string; href: string };
  children: React.ReactNode;
}

export default function DocLayout({
  title,
  description,
  breadcrumb,
  toc,
  prev,
  next,
  children,
}: DocLayoutProps) {
  return (
    <>
      <TableOfContents items={toc} />
      <div className="lg:pl-[260px] xl:pr-[220px] pt-[60px]">
        <main className="max-w-[820px] mx-auto px-6 py-8">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-[13px] text-doc-text-muted mb-6">
            <Link href="/" className="hover:text-doc-link transition-colors">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-doc-text font-medium">{breadcrumb}</span>
          </nav>

          {/* Article */}
          <article className="doc-prose">
            <h1>{title}</h1>
            <p className="text-[17px] text-doc-text-muted leading-relaxed !mb-8">
              {description}
            </p>
            {children}
          </article>

          {/* Edit link */}
          <div className="mt-10 pt-4 border-t border-doc-border">
            <a
              href="#"
              className="inline-flex items-center gap-1.5 text-[13px] text-doc-text-muted hover:text-doc-link transition-colors"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit this page
            </a>
          </div>

          {/* Prev / Next */}
          <nav className="flex items-stretch gap-4 mt-6 mb-12">
            {prev ? (
              <Link
                href={prev.href}
                className="flex-1 group border border-doc-border rounded-lg p-4 hover:border-doc-active-border transition-colors"
              >
                <span className="text-[12px] text-doc-text-muted">
                  Previous
                </span>
                <span className="block text-[15px] text-doc-link font-medium mt-0.5 group-hover:underline">
                  &laquo; {prev.label}
                </span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
            {next ? (
              <Link
                href={next.href}
                className="flex-1 group border border-doc-border rounded-lg p-4 text-right hover:border-doc-active-border transition-colors"
              >
                <span className="text-[12px] text-doc-text-muted">Next</span>
                <span className="block text-[15px] text-doc-link font-medium mt-0.5 group-hover:underline">
                  {next.label} &raquo;
                </span>
              </Link>
            ) : (
              <div className="flex-1" />
            )}
          </nav>
        </main>
      </div>
    </>
  );
}
