"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageShell } from "./PageShell";
import { DownloadButton } from "./DownloadButton";
import {
  ToolErrorNotice,
  toToolError,
  type ToolError,
  type ToolErrorBody,
} from "./ToolErrorNotice";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type FormatsResult = {
  videoId: string;
  title: string;
  webpageUrl: string;
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

// Turn a video title into a filename that is safe on every OS (Windows, macOS,
// Linux, Android, iOS): keep only broadly-legal characters, spaces → "-", trim
// stray dots/dashes, dodge Windows' reserved device names. Falls back to "video".
function safeFilename(title: string): string {
  let s = (title || "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120)
    .replace(/[-.]+$/g, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) s = `_${s}`;
  return s || "video";
}

export function DownloadContent() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ToolError | null>(null);
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
        const body = (await res.json().catch(() => ({}))) as Partial<FormatsResult> &
          ToolErrorBody;
        if (!res.ok) {
          setError(toToolError(body, res.status));
          return;
        }
        setInfo(body as FormatsResult);
      } catch (err) {
        setError({ message: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    },
    [url, loading],
  );

  const videoUrl = info?.webpageUrl ?? "";
  const dlHref = (quality: string) =>
    `${API_BASE}/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=${quality}`;

  const videoQualities = info
    ? DOWNLOADABLE.filter((h) => info.heights.includes(h))
    : [];

  const titleSlug = info ? safeFilename(info.title) : "video";

  return (
    <PageShell
      title="Video & Audio Export"
      intro="Save the video or audio from a public link on YouTube, Vimeo, TikTok, and more: the full video up to 4K, or just the audio as an MP3. Runs in your browser, with no software to install and no account needed."
      wide
      toolTabs
      compact={!!info}
      input={
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a video link (YouTube, Vimeo, TikTok, …)"
            className="flex-1 border border-ink/70 bg-paper px-4 py-3 font-body text-[16px] text-ink outline-none focus:border-ochre"
            aria-label="Video URL"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="whitespace-nowrap border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load"}
          </button>
        </form>
      }
    >
      {error && <ToolErrorNotice error={error} />}

      {info && (
        <div className="mt-12">
          <h2 className="font-display text-[22px] font-bold leading-tight text-ink">
            {info.title}
          </h2>

          <h3 className="label-eyebrow mt-8 text-ink">Video</h3>
          {videoQualities.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {videoQualities.map((h) => (
                <DownloadButton
                  key={h}
                  href={dlHref(String(h))}
                  label={HEIGHT_LABELS[h] ?? `${h}p`}
                  quality={String(h)}
                  filename={`${titleSlug}.mp4`}
                />
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
                <DownloadButton
                  href={dlHref("audio")}
                  label="Audio (MP3)"
                  quality="audio"
                  variant="secondary"
                  filename={`${titleSlug}.mp3`}
                />
              </div>
            </>
          )}

          <p className="mt-10 max-w-[640px] font-body text-[14px] italic leading-[1.6] text-ink-muted">
            Files are prepared on the server before the download begins, so it may
            sit &ldquo;pending&rdquo; for a moment. 1080p and up (especially 4K)
            can take a minute or two before the file starts saving.
          </p>
        </div>
      )}

      <section
        className={`mt-20 border-t-2 border-rule-strong pt-12 ${info ? "hidden" : ""}`}
      >
        <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          Why export a video or its audio
        </h2>
        <p className="mt-4 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          {"A local copy plays without buffering or ads, works offline on a flight or commute, and gives you a master file for editing, archiving, or reuse where you hold the rights. Pulling only the audio turns a talk, lecture, or song into an MP3 you can play anywhere."}
        </p>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          What you get
        </h2>
        <ul className="mt-4 max-w-[720px] list-disc space-y-2 pl-5 font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          <li>{"Video downloads at every resolution the source offers, up to 4K."}</li>
          <li>{"Audio-only export as an MP3 for podcasts, music, and talks."}</li>
          <li>{"The original video title, so you can confirm the right file before saving."}</li>
          <li>{"Everyday resolutions and audio for free; HD and 4K on the paid plan."}</li>
        </ul>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          How it works
        </h2>
        <ol className="mt-4 max-w-[720px] list-decimal space-y-2 pl-5 font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          <li>{"Copy the link to a video on a supported site."}</li>
          <li>{"Paste it above and select Load to see the available qualities."}</li>
          <li>{"Choose a resolution or Audio (MP3), and the file saves to your device."}</li>
        </ol>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          Related tools
        </h2>
        <p className="mt-4 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          {"Same video, more tools: get the "}
          <Link href="/transcript" className="text-ochre-deep underline hover:text-ochre">
            transcript
          </Link>
          {", grab a "}
          <Link href="/thumbnails" className="text-ochre-deep underline hover:text-ochre">
            thumbnail
          </Link>
          {", or pull its "}
          <Link href="/tags" className="text-ochre-deep underline hover:text-ochre">
            tags and keywords
          </Link>
          {". See "}
          <Link href="/pricing" className="text-ochre-deep underline hover:text-ochre">
            pricing
          </Link>
          {" for HD and 4K limits, or the "}
          <Link href="/faq" className="text-ochre-deep underline hover:text-ochre">
            FAQ
          </Link>
          {"."}
        </p>
      </section>
    </PageShell>
  );
}
