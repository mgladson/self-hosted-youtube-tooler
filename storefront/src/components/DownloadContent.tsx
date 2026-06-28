"use client";

import { useCallback, useState, type FormEvent } from "react";
import { PageShell } from "./PageShell";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type FormatsResult = {
  videoId: string;
  title: string;
  heights: number[];
  hasAudio: boolean;
};

const HEIGHT_LABELS: Record<number, string> = {
  2160: "4K",
  1440: "2K",
  1080: "1080p",
  720: "720p",
  480: "480p",
  360: "360p",
};

// The backend only merges/serves these heights as a download quality.
const DOWNLOADABLE = [2160, 1440, 1080, 720, 480, 360];

export function DownloadContent() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<FormatsResult | null>(null);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const value = url.trim();
      if (!value || loading) return;
      setLoading(true);
      setError(null);
      setInfo(null);
      try {
        const res = await fetch(
          `${API_BASE}/youtube/formats?url=${encodeURIComponent(value)}`,
        );
        const body = (await res.json().catch(() => ({}))) as Partial<FormatsResult> & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        setInfo(body as FormatsResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [url, loading],
  );

  const videoUrl = info ? `https://www.youtube.com/watch?v=${info.videoId}` : "";
  const dlHref = (quality: string) =>
    `${API_BASE}/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=${quality}`;

  const videoQualities = info
    ? DOWNLOADABLE.filter((h) => info.heights.includes(h))
    : [];

  return (
    <PageShell
      title="Download"
      intro="Paste a YouTube link to download the video at any available resolution, or just the audio."
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
          {loading ? "Loading…" : "Load"}
        </button>
      </form>

      {error && (
        <div className="mt-8 border border-crimson/60 bg-paper-warm p-5 font-body text-[15px] text-crimson">
          {error}
        </div>
      )}

      {info && (
        <div className="mt-12">
          <h2 className="font-display text-[22px] font-bold leading-tight text-ink">
            {info.title}
          </h2>

          <h3 className="label-eyebrow mt-8 text-ink">Video</h3>
          {videoQualities.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {videoQualities.map((h) => (
                <a
                  key={h}
                  href={dlHref(String(h))}
                  download
                  className="border border-ochre bg-ochre px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-paper transition-colors hover:bg-ochre-deep"
                >
                  {HEIGHT_LABELS[h] ?? `${h}p`}
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 font-body text-[15px] italic text-ink-muted">
              No downloadable video resolutions found for this video.
            </p>
          )}

          {info.hasAudio && (
            <>
              <h3 className="label-eyebrow mt-10 text-ink">Audio</h3>
              <div className="mt-3">
                <a
                  href={dlHref("audio")}
                  download
                  className="inline-block border border-rule px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
                >
                  Audio (MP3)
                </a>
              </div>
            </>
          )}

          <p className="mt-10 max-w-[640px] font-body text-[14px] italic leading-[1.6] text-ink-muted">
            Files are prepared on the server before the download begins, so it may
            sit &ldquo;pending&rdquo; for a moment — 1080p and up (especially 4K)
            can take a minute or two before the file starts saving.
          </p>
        </div>
      )}
    </PageShell>
  );
}
