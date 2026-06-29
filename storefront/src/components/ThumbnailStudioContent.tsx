"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageShell } from "./PageShell";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type Res = { key: string; label: string; w: number; h: number };

const STANDARD: readonly Res[] = [
  { key: "maxresdefault", label: "Max-res", w: 1280, h: 720 },
  { key: "sddefault", label: "SD", w: 640, h: 480 },
  { key: "hqdefault", label: "HQ", w: 480, h: 360 },
  { key: "mqdefault", label: "MQ", w: 320, h: 180 },
  { key: "default", label: "Default", w: 120, h: 90 },
];

const FRAMES: readonly Res[] = [
  { key: "1", label: "Frame 1", w: 120, h: 90 },
  { key: "2", label: "Frame 2", w: 120, h: 90 },
  { key: "3", label: "Frame 3", w: 120, h: 90 },
];

function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1, 12);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (u.hostname.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL, fall through to the loose match below
  }
  const m = s.match(/[a-zA-Z0-9_-]{11}/);
  return m ? m[0] : null;
}

export function ThumbnailStudioContent() {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const id = parseVideoId(url);
      if (!id) {
        setError("Not a valid YouTube URL or video id.");
        setVideoId(null);
        return;
      }
      setError(null);
      setUnavailable({});
      setVideoId(id);
    },
    [url],
  );

  const copyUrl = useCallback((key: string, src: string) => {
    navigator.clipboard.writeText(src).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }, []);

  const markUnavailable = useCallback((key: string) => {
    setUnavailable((u) => (u[key] ? u : { ...u, [key]: true }));
  }, []);

  const previewSrc = (key: string) => `https://i.ytimg.com/vi/${videoId}/${key}.jpg`;
  const downloadHref = (key: string) => `${API_BASE}/youtube/thumbnail?id=${videoId}&res=${key}`;

  // YouTube returns a 120×90 gray placeholder (HTTP 200, not a 404) when a larger
  // size was never generated, so width-checking on load catches what onError misses.
  const guardPlaceholder = (r: Res) => (e: { currentTarget: HTMLImageElement }) => {
    if (r.w > 120 && e.currentTarget.naturalWidth <= 120) markUnavailable(r.key);
  };

  // Highest available size becomes the hero; everything still loading defaults in.
  const hero = STANDARD.find((r) => !unavailable[r.key]) ?? null;
  const others = STANDARD.filter((r) => r !== hero && !unavailable[r.key]);
  const frames = FRAMES.filter((r) => !unavailable[r.key]);

  const renderCard = (r: Res) => {
    const src = previewSrc(r.key);
    return (
      <div key={r.key} className="overflow-hidden border border-rule">
        <a href={src} target="_blank" rel="noopener noreferrer" title="Open full size">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`${r.label} thumbnail`}
            width={r.w}
            height={r.h}
            className="block aspect-video w-full bg-paper-deep object-cover"
            onError={() => markUnavailable(r.key)}
            onLoad={guardPlaceholder(r)}
          />
        </a>
        <div className="flex items-center justify-between gap-2 border-t border-rule px-3 py-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {r.label} · {r.w}×{r.h}
          </span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => copyUrl(r.key, src)}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-ochre"
            >
              {copied === r.key ? "Copied" : "Copy"}
            </button>
            <a
              href={downloadHref(r.key)}
              download={`${videoId}-${r.key}.jpg`}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-ochre-deep transition-colors hover:text-ochre"
            >
              Download
            </a>
          </span>
        </div>
      </div>
    );
  };

  return (
    <PageShell
      title="YouTube Thumbnail Downloader"
      intro="A YouTube thumbnail downloader grabs the cover image of any public video at full resolution. Paste a link to save the thumbnail at up to 1280x720, plus HQ, SD, and auto-extracted frame grabs. Every size is free to copy or download."
      wide
      toolTabs
      compact={!!videoId}
      input={
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="flex-1 border border-ink/70 bg-paper px-4 py-3 font-body text-[16px] text-ink outline-none focus:border-ochre"
            aria-label="YouTube URL"
          />
          <button
            type="submit"
            disabled={!url.trim()}
            className="whitespace-nowrap border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            Grab
          </button>
        </form>
      }
    >

      {error && (
        <div className="mt-8 border border-crimson/60 bg-paper-warm p-5 font-body text-[15px] text-crimson">
          {error}
        </div>
      )}

      {videoId && (
        <div className="mt-12">
          {hero && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="label-eyebrow text-ink">{hero.label}</span>
                  <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-soft">
                    {hero.w}×{hero.h} · highest available
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href={downloadHref(hero.key)}
                    download={`${videoId}-${hero.key}.jpg`}
                    className="inline-block border border-ochre bg-ochre px-6 py-3 text-center font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep"
                  >
                    Download {hero.w}×{hero.h}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyUrl(hero.key, previewSrc(hero.key))}
                    className="inline-flex items-center gap-2 border border-ink/60 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
                  >
                    {copied === hero.key ? (
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                    {copied === hero.key ? "Copied" : "Copy URL"}
                  </button>
                  <a
                    href={previewSrc(hero.key)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-ink/60 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M15 3h6v6" />
                      <path d="M9 21H3v-6" />
                      <path d="M21 3l-7 7" />
                      <path d="M3 21l7-7" />
                    </svg>
                    Open full size
                  </a>
                </div>
              </div>
              <a
                href={previewSrc(hero.key)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open full size"
                className="mt-5 block overflow-hidden border border-rule"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc(hero.key)}
                  alt={`${hero.label} thumbnail`}
                  width={hero.w}
                  height={hero.h}
                  className="block h-auto w-full bg-paper-deep"
                  onError={() => markUnavailable(hero.key)}
                  onLoad={guardPlaceholder(hero)}
                />
              </a>
            </div>
          )}

          {others.length > 0 && (
            <div className="mt-12">
              <h2 className="label-eyebrow text-ink">Other sizes</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {others.map(renderCard)}
              </div>
            </div>
          )}

          {frames.length > 0 && (
            <details className="mt-12">
              <summary className="cursor-pointer label-eyebrow text-ink-soft transition-colors hover:text-ochre">
                Frame grabs ({frames.length})
              </summary>
              <p className="mt-2 font-body text-[14px] italic text-ink-muted">
                Auto-extracted still frames from points along the video timeline.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {frames.map(renderCard)}
              </div>
            </details>
          )}
        </div>
      )}

      <section
        className={`mt-20 border-t-2 border-rule-strong pt-12 ${videoId ? "hidden" : ""}`}
      >
        <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          Why download a YouTube thumbnail
        </h2>
        <p className="mt-4 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          {"The cover image is the first thing a viewer judges, so creators study the thumbnails that win in their niche for layout, color, and framing. A saved thumbnail is also useful for mockups, link previews, study, and competitive research."}
        </p>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          What you get
        </h2>
        <ul className="mt-4 max-w-[720px] list-disc space-y-2 pl-5 font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          <li>{"The highest-resolution thumbnail YouTube generated, up to 1280 x 720."}</li>
          <li>{"Every standard size: max-res, SD, HQ, MQ, and default."}</li>
          <li>{"Auto-extracted frame grabs from points along the video."}</li>
          <li>{"Copy the image URL or download the file, with no watermark."}</li>
        </ul>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          YouTube thumbnail sizes
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full max-w-[520px] border-collapse border border-rule font-body text-[15px] text-ink-soft">
            <thead>
              <tr className="bg-paper-warm">
                <th className="border border-rule px-4 py-2 text-left font-semibold text-ink">
                  Name
                </th>
                <th className="border border-rule px-4 py-2 text-left font-semibold text-ink">
                  Resolution
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-rule px-4 py-2">Max-res</td>
                <td className="border border-rule px-4 py-2">1280 x 720</td>
              </tr>
              <tr>
                <td className="border border-rule px-4 py-2">Standard (SD)</td>
                <td className="border border-rule px-4 py-2">640 x 480</td>
              </tr>
              <tr>
                <td className="border border-rule px-4 py-2">High (HQ)</td>
                <td className="border border-rule px-4 py-2">480 x 360</td>
              </tr>
              <tr>
                <td className="border border-rule px-4 py-2">Medium (MQ)</td>
                <td className="border border-rule px-4 py-2">320 x 180</td>
              </tr>
              <tr>
                <td className="border border-rule px-4 py-2">Default</td>
                <td className="border border-rule px-4 py-2">120 x 90</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          How it works
        </h2>
        <ol className="mt-4 max-w-[720px] list-decimal space-y-2 pl-5 font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          <li>{"Copy the link to any public YouTube video, or paste its video id."}</li>
          <li>{"Select Grab to load every available image."}</li>
          <li>{"Download the size you need, or copy its direct URL."}</li>
        </ol>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          Related tools
        </h2>
        <p className="mt-4 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          {"Same video, more tools: pull the "}
          <Link href="/transcript" className="text-ochre-deep underline hover:text-ochre">
            transcript
          </Link>
          {", "}
          <Link href="/download" className="text-ochre-deep underline hover:text-ochre">
            download the video or audio
          </Link>
          {", or get its "}
          <Link href="/tags" className="text-ochre-deep underline hover:text-ochre">
            tags and keywords
          </Link>
          {". See "}
          <Link href="/pricing" className="text-ochre-deep underline hover:text-ochre">
            pricing
          </Link>
          {" for daily limits, or the "}
          <Link href="/faq" className="text-ochre-deep underline hover:text-ochre">
            FAQ
          </Link>
          {"."}
        </p>
      </section>
    </PageShell>
  );
}
