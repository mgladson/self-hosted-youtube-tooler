"use client";

import { PageShell } from "./PageShell";

const TOOLS = [
  {
    name: "TinyPNG",
    href: "https://tinypng.com/",
    host: "tinypng.com",
    blurb:
      "Compress a thumbnail so it slips under YouTube's thumbnail size limit without any visible quality loss.",
  },
  {
    name: "Vocal Remover",
    href: "https://audioalter.com/vocal-remover",
    host: "audioalter.com",
    blurb:
      "Strip the vocals out of a song to get a clean instrumental to use as background music.",
  },
];

export function UsefulLinksContent() {
  return (
    <PageShell
      title="Useful Links"
      intro="A few outside tools that pair well with the extractor — for prepping thumbnails and audio before you upload."
    >
      <ul className="space-y-6">
        {TOOLS.map((tool) => (
          <li key={tool.href}>
            <a
              href={tool.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block border border-rule p-6 transition-colors hover:border-ochre"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-[22px] font-bold leading-tight text-ink transition-colors group-hover:text-ochre md:text-[26px]">
                  {tool.name}
                </h2>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                  {tool.host}
                </span>
              </div>
              <p className="mt-3 font-body text-[16px] leading-[1.7] text-ink-soft md:text-[17px]">
                {tool.blurb}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
