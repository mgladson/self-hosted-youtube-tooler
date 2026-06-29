"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageShell } from "./PageShell";
import {
  ToolErrorNotice,
  toToolError,
  type ToolError,
  type ToolErrorBody,
} from "./ToolErrorNotice";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type TranscriptEntry = { text: string; start: number; duration: number };
type TranscriptResult = {
  videoId: string;
  available: boolean;
  language: string | null;
  isAutomatic: boolean;
  text: string;
  entries: TranscriptEntry[];
};

function formatTime(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function srtTime(total: number): string {
  const ms = Math.round((total - Math.floor(total)) * 1000);
  const s = Math.floor(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`;
}

function toSrt(entries: TranscriptEntry[]): string {
  return entries
    .map((e, i) => {
      const start = srtTime(e.start);
      const end = srtTime(e.start + (e.duration || 0));
      return `${i + 1}\n${start} --> ${end}\n${e.text}`;
    })
    .join("\n\n");
}

// YouTube auto-captions "roll": each cue repeats the tail of the previous one,
// so naively joining entries duplicates most of the text. Rebuild clean prose by
// appending only the words of each cue that extend past the running overlap.
function dedupeRolling(entries: TranscriptEntry[]): string {
  const words: string[] = [];
  for (const e of entries) {
    const ew = e.text.split(/\s+/).filter(Boolean);
    let overlap = 0;
    const maxK = Math.min(words.length, ew.length);
    for (let k = maxK; k > 0; k--) {
      let match = true;
      for (let j = 0; j < k; j++) {
        if (words[words.length - k + j].toLowerCase() !== ew[j].toLowerCase()) {
          match = false;
          break;
        }
      }
      if (match) {
        overlap = k;
        break;
      }
    }
    for (let j = overlap; j < ew.length; j++) words.push(ew[j]);
  }
  return words.join(" ");
}

// Same rolling de-overlap as dedupeRolling, but timestamp-preserving: emit one
// entry per cue holding only the words that cue ADDS past the running text, kept
// at that cue's start. This turns the duplicated short/long cue pairs YouTube
// auto-captions emit into a clean, non-repeating timeline for the timestamped
// view and SRT export. Each line's duration is stretched to the next line's
// start so SRT cues stay contiguous (the source durations belonged to the
// overlapping rolling cues, not these rebuilt lines).
function dedupeRollingEntries(entries: TranscriptEntry[]): TranscriptEntry[] {
  const out: TranscriptEntry[] = [];
  const words: string[] = [];
  for (const e of entries) {
    const ew = e.text.split(/\s+/).filter(Boolean);
    let overlap = 0;
    const maxK = Math.min(words.length, ew.length);
    for (let k = maxK; k > 0; k--) {
      let match = true;
      for (let j = 0; j < k; j++) {
        if (words[words.length - k + j].toLowerCase() !== ew[j].toLowerCase()) {
          match = false;
          break;
        }
      }
      if (match) {
        overlap = k;
        break;
      }
    }
    const fresh = ew.slice(overlap);
    if (fresh.length === 0) continue;
    for (const w of fresh) words.push(w);
    out.push({ text: fresh.join(" "), start: e.start, duration: e.duration });
  }
  for (let i = 0; i < out.length - 1; i++) {
    out[i].duration = Math.max(0, out[i + 1].start - out[i].start);
  }
  return out;
}

// Plain text should be words only: strip caption sound cues like [music],
// [Music], [♪♪♪], [Applause] and the musical-note glyphs that bracket sung
// lyrics, then collapse the whitespace they leave. Parenthesised text is kept:
// in songs "(Ooh, give you up)" is a lyric, not a sound cue.
function stripNonSpeech(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[♪♫♬]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function saveFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Markdown export: clean prose under a heading with source context. Markdown is
// the most token-efficient, structure-preserving format to hand to an LLM.
function toMarkdown(result: TranscriptResult, plainText: string): string {
  const src = `https://www.youtube.com/watch?v=${result.videoId}`;
  const lang = result.language
    ? `${result.language}${result.isAutomatic ? " (auto-generated)" : ""}`
    : result.isAutomatic
      ? "auto-generated"
      : "unknown";
  return `# Transcript\n\n- **Source:** ${src}\n- **Language:** ${lang}\n\n${plainText}\n`;
}

export function TranscriptContent() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ToolError | null>(null);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [view, setView] = useState<"plain" | "timestamped">("plain");
  const [copied, setCopied] = useState(false);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const value = url.trim();
      if (!value || loading) return;
      setLoading(true);
      setError(null);
      setResult(null);
      setView("plain");
      try {
        const res = await fetch(
          `${API_BASE}/youtube/transcript?url=${encodeURIComponent(value)}`,
        );
        const body = (await res.json().catch(() => ({}))) as Partial<TranscriptResult> &
          ToolErrorBody;
        if (!res.ok) {
          setError(toToolError(body, res.status));
          return;
        }
        setResult(body as TranscriptResult);
      } catch (err) {
        setError({ message: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    },
    [url, loading],
  );

  const plainText = useMemo(() => {
    if (!result) return "";
    // Auto-captions roll (cues overlap heavily); manual captions are already clean.
    const raw = result.isAutomatic ? dedupeRolling(result.entries) : result.text;
    // Plain view is words only: drop [music]/[♪♪♪] cues and note glyphs.
    return stripNonSpeech(raw);
  }, [result]);
  // Timestamped lines for the table, Copy, and SRT. Auto-captions need the rolling
  // pairs collapsed (same as plainText); manual captions are already clean.
  const timedEntries = useMemo(() => {
    if (!result) return [];
    return result.isAutomatic ? dedupeRollingEntries(result.entries) : result.entries;
  }, [result]);
  const wordCount = useMemo(
    () => (plainText ? plainText.trim().split(/\s+/).length : 0),
    [plainText],
  );

  const copyCurrent = useCallback(() => {
    if (!result) return;
    const content =
      view === "plain"
        ? plainText
        : timedEntries.map((e) => `[${formatTime(e.start)}] ${e.text}`).join("\n");
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [result, view, plainText, timedEntries]);

  const fileBase = result?.videoId ? `transcript-${result.videoId}` : "transcript";

  const toolBtn =
    "border border-ink/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre";

  // Embedded player shown above the transcript. The standard YouTube iframe
  // renders the thumbnail, title, and play button until the viewer clicks to
  // play in place. Defined once and reused by both result branches below.
  const videoEmbed = result?.videoId ? (
    <iframe
      className="mb-6 aspect-video w-full border border-rule"
      src={`https://www.youtube.com/embed/${result.videoId}`}
      title={`YouTube video player: ${result.videoId}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      loading="lazy"
    />
  ) : null;

  return (
    <PageShell
      title="YouTube Transcript Generator"
      intro="A YouTube transcript generator turns any public video's captions into clean, readable text. Paste a link to get the full transcript in seconds, as plain text or with timestamps, then copy it or download it as TXT, MD, or SRT."
      wide
      toolTabs
      compact={!!result}
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
            disabled={loading || !url.trim()}
            className="whitespace-nowrap border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Fetching…" : "Get transcript"}
          </button>
        </form>
      }
    >
      {error && <ToolErrorNotice error={error} />}

      {result &&
        (result.available ? (
          <div className="mt-12">
            {videoEmbed}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="label-eyebrow text-ink">
                Transcript ({timedEntries.length} lines · {wordCount} words
                {result.language ? ` · ${result.language}` : ""}
                {result.isAutomatic ? " · auto" : ""})
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex border border-rule">
                  <button
                    type="button"
                    onClick={() => setView("plain")}
                    className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors ${
                      view === "plain" ? "bg-ochre text-paper" : "text-ink-soft hover:text-ochre"
                    }`}
                  >
                    Plain
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("timestamped")}
                    className={`px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors ${
                      view === "timestamped"
                        ? "bg-ochre text-paper"
                        : "text-ink-soft hover:text-ochre"
                    }`}
                  >
                    Timestamps
                  </button>
                </div>
                <button type="button" onClick={copyCurrent} className={toolBtn}>
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={() => saveFile(`${fileBase}.txt`, plainText)}
                  className={toolBtn}
                >
                  TXT
                </button>
                <button
                  type="button"
                  onClick={() => saveFile(`${fileBase}.md`, toMarkdown(result, plainText))}
                  className={toolBtn}
                >
                  MD
                </button>
                <button
                  type="button"
                  onClick={() => saveFile(`${fileBase}.srt`, toSrt(timedEntries))}
                  className={toolBtn}
                >
                  SRT
                </button>
              </div>
            </div>

            {view === "plain" ? (
              <div className="mt-4 max-h-[560px] overflow-y-auto border border-rule bg-paper-warm p-6">
                <p className="whitespace-pre-wrap font-body text-[15px] leading-[1.75] text-ink-soft">
                  {plainText}
                </p>
              </div>
            ) : (
              <div className="mt-4 max-h-[560px] overflow-y-auto border border-rule">
                <table className="w-full border-collapse">
                  <tbody>
                    {timedEntries.map((entry, i) => (
                      <tr
                        key={i}
                        className={`align-top ${i % 2 === 1 ? "bg-paper-warm" : ""}`}
                      >
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
            )}
          </div>
        ) : (
          <div className="mt-12">
            {videoEmbed}
            <p className="font-body text-[15px] italic text-ink-muted">
              This video has no captions available.
            </p>
          </div>
        ))}

      <section
        className={`mt-20 border-t-2 border-rule-strong pt-12 ${result ? "hidden" : ""}`}
      >
        <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          Why use a transcript
        </h2>
        <p className="mt-4 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          {"A written version of a video is faster to skim than watching, simple to search for one quote, and ready to repurpose into blog posts, show notes, subtitles, or summaries. It also makes the content accessible to people who are deaf or hard of hearing, and gives AI tools clean text to work from."}
        </p>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          What you get
        </h2>
        <ul className="mt-4 max-w-[720px] list-disc space-y-2 pl-5 font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          <li>{"The full transcript of any public YouTube video that has captions."}</li>
          <li>{"A clean plain-text view with caption noise such as [Music] removed."}</li>
          <li>{"A timestamped view that pairs every line with the moment it is spoken."}</li>
          <li>{"One-click export to TXT, Markdown, or SRT subtitle files."}</li>
        </ul>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          How it works
        </h2>
        <ol className="mt-4 max-w-[720px] list-decimal space-y-2 pl-5 font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          <li>{"Copy the link to any public YouTube video."}</li>
          <li>{"Paste it into the box above and select Get transcript."}</li>
          <li>{"Read the text, then copy it or download it in the format you need."}</li>
        </ol>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          Related tools
        </h2>
        <p className="mt-4 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          {"Working with the same video? Grab its "}
          <Link href="/thumbnails" className="text-ochre-deep underline hover:text-ochre">
            thumbnail
          </Link>
          {", get the "}
          <Link href="/download" className="text-ochre-deep underline hover:text-ochre">
            video or audio download
          </Link>
          {", or pull its "}
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
          {" for common questions."}
        </p>
      </section>
    </PageShell>
  );
}
