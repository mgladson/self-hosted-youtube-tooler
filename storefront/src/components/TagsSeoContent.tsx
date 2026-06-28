"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { PageShell } from "./PageShell";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// YouTube enforces a 500-character cap across all tags (commas included).
const TAG_CHAR_LIMIT = 500;

type ExtractResult = {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
};

const STOPWORDS = new Set(
  "the a an and or but if then else for to of in on at by with from as is are was were be been being it its this that these those you your we our us they them their he she his her i me my mine do does did done how what when where which who why will would can could should your you'll about into out up down over under more most very just so than too can't won't not no yes get got make made how-to".split(
    /\s+/,
  ),
);

function keywordIdeas(title: string, description: string, tags: string[]): string[] {
  const text = `${title} ${description} ${tags.join(" ")}`.toLowerCase();
  const words = text.match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    if (/^\d+$/.test(w)) continue; // bare numbers (years, timestamps)
    if (/^(?:https?|www|com|net|org|co)$/.test(w)) continue; // URL fragments
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([w]) => w);
}

export function TagsSeoContent() {
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

  const tags = result?.tags ?? [];
  const tagsString = useMemo(() => tags.join(", "), [tags]);
  const keywords = useMemo(
    () => (result ? keywordIdeas(result.title, result.description, tags) : []),
    [result, tags],
  );

  const copyTags = useCallback(() => {
    navigator.clipboard.writeText(tagsString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [tagsString]);

  const overLimit = tagsString.length > TAG_CHAR_LIMIT;

  return (
    <PageShell
      title="Tags & SEO"
      intro="Paste a YouTube link to pull its tags and surface keyword ideas for your own titles, tags, and descriptions."
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
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {error && (
        <div className="mt-8 border border-crimson/60 bg-paper-warm p-5 font-body text-[15px] text-crimson">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-12">
          <h2 className="font-display text-[22px] font-bold leading-tight text-ink">
            {result.title}
          </h2>

          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="label-eyebrow text-ink">Tags ({tags.length})</h3>
              {tags.length > 0 && (
                <div className="flex items-center gap-4">
                  <span
                    className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
                      overLimit ? "text-crimson" : "text-ink-muted"
                    }`}
                  >
                    {tagsString.length} / {TAG_CHAR_LIMIT} chars
                  </span>
                  <button
                    type="button"
                    onClick={copyTags}
                    className="whitespace-nowrap border border-ink/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ochre hover:text-ochre"
                  >
                    {copied ? "Copied" : "Copy all"}
                  </button>
                </div>
              )}
            </div>

            {tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <span
                    key={`${tag}-${i}`}
                    className="border border-rule px-2 py-1 font-mono text-[12px] text-ink-soft"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 font-body text-[15px] italic text-ink-muted">
                This video has no public tags.
              </p>
            )}
          </div>

          {keywords.length > 0 && (
            <div className="mt-10">
              <h3 className="label-eyebrow mb-2 text-ink">
                Keyword ideas (from title, description &amp; tags)
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="border border-rule bg-paper-warm px-2 py-1 font-mono text-[12px] text-ink-soft"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
