import Link from "next/link";
import { absoluteUrl } from "@/lib/seo";
import { PageShell } from "./PageShell";

// Server Component (no "use client"): the API reference is static, code-heavy, and
// English-only, so the copy lives inline here rather than in the shared i18n bundle.

const BASE = absoluteUrl("/api/v1");

type Param = { name: string; required?: boolean; desc: string };
type Endpoint = {
  method: string;
  path: string;
  cost: string;
  summary: string;
  params: Param[];
  example: string;
  response: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/youtube/video",
    cost: "1 credit",
    summary: "Full video metadata (title, description, tags, chapters, most-replayed heatmap, counts) plus the transcript.",
    params: [{ name: "url", required: true, desc: "A YouTube URL (any form) or a bare 11-character video id." }],
    example: `curl "${BASE}/youtube/video?url=https://youtu.be/dQw4w9WgXcQ" \\
  -H "Authorization: Bearer sk_live_..."`,
    response: `{
  "videoId": "dQw4w9WgXcQ",
  "title": "…",
  "description": "…",
  "tags": ["…"],
  "channel": "…",
  "duration": 213,
  "viewCount": 1600000000,
  "chapters": [{ "title": "Intro", "start": 0 }],
  "thumbnails": [{ "url": "…", "width": 1280, "height": 720 }],
  "transcript": {
    "available": true,
    "language": "en",
    "isAutomatic": false,
    "text": "We're no strangers to love …",
    "entries": [{ "text": "We're no strangers to love", "start": 0.0, "duration": 3.1 }]
  }
}`,
  },
  {
    method: "GET",
    path: "/youtube/metadata",
    cost: "1 credit",
    summary: "Metadata only, without the transcript. Lighter than /youtube/video when you don't need captions.",
    params: [{ name: "url", required: true, desc: "A YouTube URL or 11-character video id." }],
    example: `curl "${BASE}/youtube/metadata?url=dQw4w9WgXcQ" \\
  -H "Authorization: Bearer sk_live_..."`,
    response: `{
  "videoId": "dQw4w9WgXcQ",
  "title": "…",
  "channel": "…",
  "duration": 213,
  "viewCount": 1600000000,
  "likeCount": 18000000,
  "uploadDate": "2009-10-25"
}`,
  },
  {
    method: "GET",
    path: "/youtube/transcript",
    cost: "1 credit",
    summary: "The transcript on its own, with per-line timestamps and a plain-text rendering.",
    params: [{ name: "url", required: true, desc: "A YouTube URL or 11-character video id." }],
    example: `curl "${BASE}/youtube/transcript?url=dQw4w9WgXcQ" \\
  -H "Authorization: Bearer sk_live_..."`,
    response: `{
  "videoId": "dQw4w9WgXcQ",
  "available": true,
  "language": "en",
  "isAutomatic": false,
  "text": "We're no strangers to love …",
  "entries": [
    { "text": "We're no strangers to love", "start": 0.0, "duration": 3.1 }
  ]
}`,
  },
  {
    method: "GET",
    path: "/youtube/formats",
    cost: "1 credit",
    summary: "The distinct video resolutions a source offers, plus whether an audio track exists. Also accepts Vimeo, Dailymotion, TikTok, Twitch, SoundCloud, X, and Reddit URLs.",
    params: [{ name: "url", required: true, desc: "A supported video URL (or a YouTube id)." }],
    example: `curl "${BASE}/youtube/formats?url=dQw4w9WgXcQ" \\
  -H "Authorization: Bearer sk_live_..."`,
    response: `{
  "videoId": "dQw4w9WgXcQ",
  "title": "…",
  "webpageUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "heights": [144, 240, 360, 480, 720, 1080],
  "hasAudio": true
}`,
  },
  {
    method: "GET",
    path: "/youtube/thumbnails",
    cost: "1 credit",
    summary: "Canonical thumbnail URLs at every rendition. maxresdefault and sddefault are not present for every video.",
    params: [{ name: "url", required: true, desc: "A YouTube URL or 11-character video id." }],
    example: `curl "${BASE}/youtube/thumbnails?url=dQw4w9WgXcQ" \\
  -H "Authorization: Bearer sk_live_..."`,
    response: `{
  "videoId": "dQw4w9WgXcQ",
  "thumbnails": [
    { "quality": "maxresdefault", "width": 1280, "height": 720, "url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" },
    { "quality": "hqdefault", "width": 480, "height": 360, "url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" }
  ]
}`,
  },
  {
    method: "GET",
    path: "/youtube/download",
    cost: "2–8 credits",
    summary: "Downloads the media. Responds with the file as an attachment, or a 302 redirect to a short-lived URL when the server-side cache is warm — follow redirects. Video is merged to MP4; audio is returned as MP3.",
    params: [
      { name: "url", required: true, desc: "A supported video URL (or a YouTube id)." },
      { name: "quality", required: true, desc: "One of: audio, 360, 480, 720, 1080, 1440, 2160." },
    ],
    example: `curl -L "${BASE}/youtube/download?url=dQw4w9WgXcQ&quality=1080" \\
  -H "Authorization: Bearer sk_live_..." \\
  -o video.mp4`,
    response: `# 200 → the media file streamed as an attachment (Content-Disposition),
# or 302 → a short-lived download URL (follow it with curl -L).`,
  },
];

const COSTS: { call: string; cost: string }[] = [
  { call: "video, metadata, transcript, formats, thumbnails", cost: "1 credit" },
  { call: "download — audio and up to 720p", cost: "2 credits" },
  { call: "download — 1080p", cost: "4 credits" },
  { call: "download — 1440p and 2160p (4K)", cost: "8 credits" },
];

const ERRORS: { status: string; code: string; meaning: string }[] = [
  { status: "400", code: "invalid_url / invalid_quality", meaning: "The url or quality parameter was missing or malformed. No credits charged." },
  { status: "401", code: "unauthorized / invalid_api_key", meaning: "The Authorization header was missing, or the key is unknown or revoked." },
  { status: "402", code: "insufficient_credits", meaning: "Not enough credits for the call. The body includes your balance and the amount required." },
  { status: "404", code: "unavailable", meaning: "The video is private, removed, or does not exist. No credits charged." },
  { status: "429", code: "rate_limited", meaning: "Per-key rate limit exceeded. Respect the Retry-After header. No credits charged." },
  { status: "504", code: "timeout", meaning: "The upstream fetch timed out. No credits charged; safe to retry." },
  { status: "502", code: "fetch_failed", meaning: "The upstream fetch failed. No credits charged." },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 mt-16 flex items-center gap-4">
      <span className="label-eyebrow text-ochre">{children}</span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-4 overflow-x-auto border border-rule bg-paper-deep p-4 font-mono text-[13px] leading-relaxed text-ink">
      <code>{children}</code>
    </pre>
  );
}

export function DocsContent() {
  return (
    <PageShell
      eyebrow="Developers"
      title="API documentation"
      intro="A REST API for YouTube metadata, transcripts, formats, thumbnails, and downloads. Authenticate with a key, pay per successful call in credits."
      wide
    >
      <div className="max-w-[820px]">
        {/* Base URL */}
        <p className="font-body text-[16px] leading-[1.7] text-ink-soft">
          All endpoints live under a single base URL and return JSON (the download
          endpoint returns the media file). Every request must be authenticated with an
          API key.
        </p>
        <Code>{BASE}</Code>

        {/* Authentication */}
        <Eyebrow>Authentication</Eyebrow>
        <p className="font-body text-[16px] leading-[1.7] text-ink-soft">
          Pass your key as a bearer token on every request. Create and manage keys on your{" "}
          <Link href="/account" className="text-ochre-deep underline hover:text-ochre">
            account page
          </Link>{" "}
          — the secret is shown once, so store it somewhere safe. Keep keys server-side;
          never ship them in browser or mobile code.
        </p>
        <Code>{`Authorization: Bearer sk_live_your_key_here`}</Code>

        {/* Credits */}
        <Eyebrow>Credits &amp; pricing</Eyebrow>
        <p className="font-body text-[16px] leading-[1.7] text-ink-soft">
          The API is metered in credits. A credit is deducted only when a call succeeds —
          failed and rate-limited requests cost nothing. Cached results still cost a
          credit (you are paying for the data, served instantly). New accounts start with
          a one-time grant of 100 free credits; top up any time from your account page.
        </p>
        <div className="mt-6 overflow-x-auto border border-rule">
          <table className="w-full border-collapse text-left font-body text-[15px]">
            <thead>
              <tr className="border-b border-rule-strong bg-paper-deep">
                <th className="p-3 font-mono text-[12px] uppercase tracking-[0.12em] text-ink-soft">Call</th>
                <th className="p-3 font-mono text-[12px] uppercase tracking-[0.12em] text-ink-soft">Cost</th>
              </tr>
            </thead>
            <tbody>
              {COSTS.map((c) => (
                <tr key={c.call} className="border-b border-rule last:border-0">
                  <td className="p-3 text-ink-soft">{c.call}</td>
                  <td className="p-3 font-mono text-[13px] text-ink">{c.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rate limits */}
        <Eyebrow>Rate limits</Eyebrow>
        <p className="font-body text-[16px] leading-[1.7] text-ink-soft">
          Requests are limited per key: 120 requests per minute for lookups, and a
          tighter budget for the heavier download endpoint. Every response carries the
          current window state; a 429 also sends <span className="font-mono text-[13px]">Retry-After</span>.
        </p>
        <Code>{`X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1751385600
Retry-After: 41            # only on 429`}</Code>

        {/* Endpoints */}
        <Eyebrow>Endpoints</Eyebrow>
        <div className="space-y-12">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="border border-ochre px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ochre-deep">
                  {ep.method}
                </span>
                <code className="font-mono text-[15px] text-ink">/api/v1{ep.path}</code>
                <span className="font-mono text-[12px] text-ink-muted">· {ep.cost}</span>
              </div>
              <p className="mt-3 max-w-[680px] font-body text-[15px] leading-[1.7] text-ink-soft">
                {ep.summary}
              </p>
              <div className="mt-4 border-l-2 border-rule pl-4">
                <p className="label-eyebrow text-ink">Query parameters</p>
                <ul className="mt-2 space-y-1.5">
                  {ep.params.map((p) => (
                    <li key={p.name} className="font-body text-[14px] text-ink-soft">
                      <code className="font-mono text-[13px] text-ink">{p.name}</code>
                      {p.required ? (
                        <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.1em] text-crimson">required</span>
                      ) : (
                        <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">optional</span>
                      )}
                      <span className="ml-2">— {p.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Code>{ep.example}</Code>
              <Code>{ep.response}</Code>
            </div>
          ))}
        </div>

        {/* Errors */}
        <Eyebrow>Errors</Eyebrow>
        <p className="font-body text-[16px] leading-[1.7] text-ink-soft">
          Errors return a JSON body of the shape{" "}
          <code className="font-mono text-[13px] text-ink">{`{ "error": "…", "code": "…" }`}</code>. A
          402 also includes <span className="font-mono text-[13px]">balance</span> and{" "}
          <span className="font-mono text-[13px]">required</span>.
        </p>
        <div className="mt-6 overflow-x-auto border border-rule">
          <table className="w-full border-collapse text-left font-body text-[14px]">
            <thead>
              <tr className="border-b border-rule-strong bg-paper-deep">
                <th className="p-3 font-mono text-[12px] uppercase tracking-[0.12em] text-ink-soft">Status</th>
                <th className="p-3 font-mono text-[12px] uppercase tracking-[0.12em] text-ink-soft">Code</th>
                <th className="p-3 font-mono text-[12px] uppercase tracking-[0.12em] text-ink-soft">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map((e) => (
                <tr key={e.status + e.code} className="border-b border-rule last:border-0 align-top">
                  <td className="p-3 font-mono text-[13px] text-ink">{e.status}</td>
                  <td className="p-3 font-mono text-[12px] text-ink-soft">{e.code}</td>
                  <td className="p-3 text-ink-soft">{e.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quickstart */}
        <Eyebrow>Quickstart</Eyebrow>
        <p className="font-body text-[16px] leading-[1.7] text-ink-soft">
          Fetch a transcript from Node.js:
        </p>
        <Code>{`const res = await fetch(
  "${BASE}/youtube/transcript?url=dQw4w9WgXcQ",
  { headers: { Authorization: \`Bearer \${process.env.API_KEY}\` } },
);
if (res.status === 402) throw new Error("Out of credits");
if (!res.ok) throw new Error((await res.json()).error);
const { text } = await res.json();
console.log(text);`}</Code>
        <p className="mt-6 font-body text-[16px] leading-[1.7] text-ink-soft">
          …or Python:
        </p>
        <Code>{`import os, requests

r = requests.get(
    "${BASE}/youtube/transcript",
    params={"url": "dQw4w9WgXcQ"},
    headers={"Authorization": f"Bearer {os.environ['API_KEY']}"},
)
r.raise_for_status()
print(r.json()["text"])`}</Code>

        <p className="mt-14 font-body text-[15px] italic leading-[1.7] text-ink-muted">
          Ready to build?{" "}
          <Link href="/account" className="text-ochre-deep underline hover:text-ochre">
            Create your first API key
          </Link>
          .
        </p>
      </div>
    </PageShell>
  );
}
