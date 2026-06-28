"use client";

import { useCallback, useState, type FormEvent } from "react";
import { PageShell } from "./PageShell";

type TranscriptEntry = { text: string; start: number; duration: number };
type Transcript = {
  available: boolean;
  language: string | null;
  isAutomatic: boolean;
  text: string;
  entries: TranscriptEntry[];
};
type Thumbnail = { url: string; width: number | null; height: number | null };
type ExtractResult = {
  videoId: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  channel: string;
  durationText: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  uploadDate: string | null;
  thumbnail: Thumbnail | null;
  transcript: Transcript;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function formatTime(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function formatCount(n: number | null): string {
  return n == null ? "" : n.toLocaleString();
}

export function YouTubeToolContent() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const value = url.trim();
      if (!value || loading) return;
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await fetch(
          `${API_BASE}/youtube/extract?url=${encodeURIComponent(value)}`,
        );
        const body = (await res.json().catch(() => ({}))) as Partial<ExtractResult> & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        setResult(body as ExtractResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [url, loading],
  );

  const copyTranscript = useCallback(() => {
    if (!result?.transcript.text) return;
    navigator.clipboard.writeText(result.transcript.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [result]);

  return (
    <PageShell
      title="YouTube Extractor"
      intro="Paste a YouTube link to pull its transcript, title, description, tags, and thumbnail."
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
          disabled={loading || !url.trim()}
          className="whitespace-nowrap border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Extracting…" : "Extract"}
        </button>
      </form>

      {error && (
        <div className="mt-8 border border-crimson/60 bg-paper-warm p-5 font-body text-[15px] text-crimson">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[320px_1fr]">
            {result.thumbnail?.url && (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.thumbnail.url}
                  alt={result.title}
                  className="w-full border border-ink/20"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = `https://i.ytimg.com/vi/${result.videoId}/hqdefault.jpg`;
                  }}
                />
                <a
                  href={result.thumbnail.url}
                  download={`${result.videoId}.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft underline hover:text-ochre"
                >
                  Download thumbnail
                </a>
              </div>
            )}

            <div>
              <h2 className="font-display text-[26px] font-bold leading-tight text-ink">
                {result.title}
              </h2>
              <p className="mt-2 font-body text-[15px] text-ink-soft">
                {result.channel}
                {result.durationText && <> · {result.durationText}</>}
                {result.viewCount != null && <> · {formatCount(result.viewCount)} views</>}
                {result.uploadDate && <> · {result.uploadDate.slice(0, 10)}</>}
              </p>

              {result.tags.length > 0 && (
                <div className="mt-5">
                  <h3 className="label-eyebrow mb-2 text-ink">Tags ({result.tags.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.tags.map((tag, i) => (
                      <span
                        key={`${tag}-${i}`}
                        className="border border-rule px-2 py-1 font-mono text-[11px] text-ink-soft"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.description && (
                <details className="mt-5">
                  <summary className="cursor-pointer font-display text-[16px] italic text-ink-soft hover:text-ochre">
                    Description
                  </summary>
                  <pre className="mt-3 whitespace-pre-wrap font-body text-[14px] leading-[1.6] text-ink-soft">
                    {result.description}
                  </pre>
                </details>
              )}
            </div>
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between gap-4">
              <h3 className="label-eyebrow text-ink">
                Transcript
                {result.transcript.available &&
                  ` (${result.transcript.entries.length} lines · ${result.transcript.language}${
                    result.transcript.isAutomatic ? " · auto" : ""
                  })`}
              </h3>
              {result.transcript.available && (
                <button
                  onClick={copyTranscript}
                  className="whitespace-nowrap border border-ink/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
                >
                  {copied ? "Copied" : "Copy all"}
                </button>
              )}
            </div>

            {result.transcript.available ? (
              <div className="mt-4 max-h-[520px] overflow-y-auto border border-rule">
                <table className="w-full border-collapse">
                  <tbody>
                    {result.transcript.entries.map((entry, i) => (
                      <tr key={i} className="border-b border-rule/60 align-top">
                        <td className="w-20 px-3 py-2 font-mono text-[12px] text-ochre-deep">
                          {formatTime(entry.start)}
                        </td>
                        <td className="px-3 py-2 font-body text-[15px] leading-[1.5] text-ink-soft">
                          {entry.text}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 font-body text-[15px] italic text-ink-muted">
                This video has no captions available.
              </p>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
