"use client";

import { useCallback, useState, type FormEvent } from "react";
import { PageShell } from "./PageShell";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const RESOLUTIONS = [
  { key: "maxresdefault", label: "Max-res", w: 1280, h: 720 },
  { key: "sddefault", label: "SD", w: 640, h: 480 },
  { key: "hqdefault", label: "HQ", w: 480, h: 360 },
  { key: "mqdefault", label: "MQ", w: 320, h: 180 },
  { key: "default", label: "Default", w: 120, h: 90 },
  { key: "1", label: "Frame 1", w: 120, h: 90 },
  { key: "2", label: "Frame 2", w: 120, h: 90 },
  { key: "3", label: "Frame 3", w: 120, h: 90 },
] as const;

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
    // not a URL — fall through to the loose match below
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

  return (
    <PageShell
      title="Thumbnails"
      intro="Paste a YouTube link to grab every thumbnail resolution — preview it, copy the URL, or download the file."
      wide
    >
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

      {error && (
        <div className="mt-8 border border-crimson/60 bg-paper-warm p-5 font-body text-[15px] text-crimson">
          {error}
        </div>
      )}

      {videoId && (
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RESOLUTIONS.map((r) => {
            if (unavailable[r.key]) return null;
            const src = `https://i.ytimg.com/vi/${videoId}/${r.key}.jpg`;
            const download = `${API_BASE}/youtube/thumbnail?id=${videoId}&res=${r.key}`;
            return (
              <div key={r.key} className="overflow-hidden border border-rule">
                <a href={src} target="_blank" rel="noopener noreferrer" title="Open full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${r.label} thumbnail`}
                    className="block aspect-video w-full bg-paper-deep object-cover"
                    onError={() => setUnavailable((u) => ({ ...u, [r.key]: true }))}
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
                      {copied === r.key ? "Copied" : "Copy URL"}
                    </button>
                    <a
                      href={download}
                      download={`${videoId}-${r.key}.jpg`}
                      className="font-mono text-[11px] uppercase tracking-[0.14em] text-ochre-deep transition-colors hover:text-ochre"
                    >
                      Download
                    </a>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
