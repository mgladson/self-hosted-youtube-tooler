"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PageShell } from "./PageShell";
import { useViewerAuth } from "./ViewerAuthProvider";
import {
  ToolErrorNotice,
  toToolError,
  type ToolError,
  type ToolErrorBody,
} from "./ToolErrorNotice";
import {
  buildZip,
  safeFilename,
  saveBlob,
  videoReportMarkdown,
  type VideoExtract,
} from "@/lib/report";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type PreviewEntry = { videoId: string; title: string; duration: number | null };
type PreviewResult = {
  playlistId: string;
  title: string;
  totalCount: number;
  cappedCount: number;
  capped: boolean;
  totalDuration: number;
  entries: PreviewEntry[];
};

type JobItem = {
  position: number;
  video_id: string;
  title: string;
  duration: number | null;
  status: string;
  error: string | null;
};
type JobStatus = {
  id: string;
  playlist_id: string;
  title: string | null;
  status: string;
  total_videos: number;
  completed_videos: number;
  failed_videos: number;
  partial_reason: string | null;
  queuePosition: number;
  items: JobItem[];
};

const FINISHED = new Set(["done", "failed", "skipped"]);

function fmtDuration(total: number | null): string {
  if (total == null || total <= 0) return "";
  const s = Math.floor(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

function statusMeta(s: string): { label: string; cls: string } {
  switch (s) {
    case "done":
      return { label: "Done", cls: "border-ochre text-ochre-deep" };
    case "running":
      return { label: "Working", cls: "border-ochre bg-ochre text-paper" };
    case "completed":
      return { label: "Completed", cls: "border-ochre bg-ochre text-paper" };
    case "failed":
      return { label: "Failed", cls: "border-crimson text-crimson" };
    case "skipped":
      return { label: "Skipped", cls: "border-rule text-ink-muted" };
    case "canceled":
      return { label: "Canceled", cls: "border-rule text-ink-muted" };
    default:
      return { label: "Queued", cls: "border-rule text-ink-muted" };
  }
}

function StatusPill({ status }: { status: string }) {
  const { label, cls } = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${cls}`}
    >
      {label}
    </span>
  );
}

export function PlaylistContent() {
  const { user, plan, loading: authLoading } = useViewerAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ToolError | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const isSupporter = plan === "pro";
  const jobActive = !!job && (job.status === "queued" || job.status === "running");

  // Resume an in-flight job on mount (so a paid, quota-spending job is never
  // orphaned in the UI after a reload or navigating away).
  const resumeActiveJob = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/youtube/playlist/jobs`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { jobs?: { id: string; status: string }[] };
      const recent = data.jobs?.[0];
      if (!recent || (recent.status !== "queued" && recent.status !== "running")) return;
      const detail = await fetch(`${API_BASE}/youtube/playlist/jobs/${recent.id}`, {
        credentials: "include",
      });
      if (detail.ok) setJob((await detail.json()) as JobStatus);
    } catch {
      // best-effort — a failed recovery just leaves the empty state
    }
  }, []);

  useEffect(() => {
    // Job recovery needs a session; skip it for anonymous visitors so the public
    // page never fires a 401 (only Supporters have jobs to resume anyway).
    if (authLoading || !user) return;
    void resumeActiveJob();
  }, [authLoading, user, resumeActiveJob]);

  // Poll the active job every 2.5s until it reaches a terminal state.
  useEffect(() => {
    if (!jobActive || !job) return;
    const jobId = job.id;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/youtube/playlist/jobs/${jobId}`, {
          credentials: "include",
        });
        if (res.ok) {
          setJob((await res.json()) as JobStatus);
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          // Session expired or the job is gone: stop polling (clearing job ends this
          // effect) and say so, instead of looping on a permanent 4xx forever. Clear the
          // stale preview too, so the error isn't shown beneath an old video list.
          setError({
            message:
              "Lost access to this job. Your session may have expired, or the job was removed. Reload to sign in again.",
          });
          setPreview(null);
          setJob(null);
        }
        // other statuses (5xx / transient) fall through and keep polling
      } catch {
        // keep polling on transient network errors
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [jobActive, job?.id]);

  const onSubmitPreview = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const value = url.trim();
      if (!value || loading) return;
      setLoading(true);
      setError(null);
      setPreview(null);
      setJob(null);
      try {
        const res = await fetch(
          `${API_BASE}/youtube/playlist/preview?url=${encodeURIComponent(value)}`,
          { credentials: "include" },
        );
        const body = (await res.json().catch(() => ({}))) as Partial<PreviewResult> &
          ToolErrorBody;
        if (!res.ok) {
          setError(toToolError(body, res.status));
          return;
        }
        setPreview(body as PreviewResult);
      } catch (err) {
        setError({ message: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    },
    [url, loading],
  );

  const startJob = useCallback(async () => {
    // Submit the previewed playlist, not the live input (which the user may have edited
    // after loading the preview). preview is always set when this button is shown.
    const target = preview?.playlistId ?? url.trim();
    if (!target || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/youtube/playlist/jobs`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const body = (await res.json().catch(() => ({}))) as { jobId?: string } & ToolErrorBody;
      if (res.status === 409) {
        // Already has an active job: recover and show it, with no error banner.
        await resumeActiveJob();
        return;
      }
      if (!res.ok) {
        setError(toToolError(body, res.status));
        return;
      }
      if (body.jobId) {
        const detail = await fetch(`${API_BASE}/youtube/playlist/jobs/${body.jobId}`, {
          credentials: "include",
        });
        if (detail.ok) setJob((await detail.json()) as JobStatus);
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSubmitting(false);
    }
  }, [preview, url, submitting, resumeActiveJob]);

  const cancelJob = useCallback(async () => {
    if (!job) return;
    try {
      await fetch(`${API_BASE}/youtube/playlist/jobs/${job.id}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const detail = await fetch(`${API_BASE}/youtube/playlist/jobs/${job.id}`, {
        credentials: "include",
      });
      if (detail.ok) setJob((await detail.json()) as JobStatus);
    } catch {
      // ignore — the next poll (or reload) will reflect the state
    }
  }, [job]);

  const downloadAll = useCallback(async () => {
    if (!job || downloadingAll) return;
    const done = job.items.filter((it) => it.status === "done");
    if (!done.length) return;
    setDownloadingAll(true);
    setError(null);
    try {
      const enc = new TextEncoder();
      // Fetch the (warm-cached) extracts concurrently; keep the NN- order by index.
      const built = await Promise.all(
        done.map(async (it, i) => {
          try {
            const res = await fetch(
              `${API_BASE}/youtube/extract?url=${encodeURIComponent(it.video_id)}`,
              { credentials: "include" },
            );
            if (!res.ok) return null;
            const v = (await res.json()) as VideoExtract;
            const base = safeFilename(v.title || it.title || it.video_id);
            return {
              name: `${String(i + 1).padStart(2, "0")}-${base}.md`,
              data: enc.encode(videoReportMarkdown(v)),
            };
          } catch {
            return null;
          }
        }),
      );
      const files = built.flatMap((f) => (f ? [f] : []));
      if (files.length) {
        saveBlob(`${safeFilename(job.title || "playlist")}-reports.zip`, buildZip(files));
      } else {
        setError({
          message:
            "Could not build the bundle: those videos are no longer cached. Open them individually to refetch.",
        });
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Download failed." });
    } finally {
      setDownloadingAll(false);
    }
  }, [job, downloadingAll]);

  const hasResult = !!preview || !!job;
  const processed = job ? job.items.filter((it) => FINISHED.has(it.status)).length : 0;
  const pct = job && job.total_videos ? Math.round((processed / job.total_videos) * 100) : 0;

  const processButton = (() => {
    if (authLoading) {
      return (
        <span
          className="inline-block cursor-default border border-ochre bg-ochre px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-paper opacity-50"
          aria-hidden="true"
        >
          Process playlist
        </span>
      );
    }
    if (!isSupporter) {
      return (
        <Link
          href="/pricing"
          className="inline-block border border-ochre bg-ochre px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-paper transition-colors hover:bg-ochre-deep"
          title="Batch processing is a Supporter feature"
        >
          Process playlist · Supporter
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={startJob}
        disabled={submitting}
        className="border border-ochre bg-ochre px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-paper transition-colors hover:bg-ochre-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Starting…" : "Process playlist"}
      </button>
    );
  })();

  return (
    <PageShell
      title="Playlist Batch"
      intro={
        hasResult
          ? undefined
          : "Paste a YouTube playlist to pull metadata, tags, thumbnails, and transcripts for every video in one batch. Previewing a playlist is free; processing the whole list is a Supporter feature. Video and audio downloads stay on the single-video tool."
      }
      wide
      compact={hasResult}
    >
      <div className="border-2 border-ochre bg-paper-deep p-5 md:p-7 print:hidden">
        <form onSubmit={onSubmitPreview} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube playlist link (…/playlist?list=…)"
            className="flex-1 border border-ink/70 bg-paper px-4 py-3 font-body text-[16px] text-ink outline-none focus:border-ochre"
            aria-label="YouTube playlist URL"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="whitespace-nowrap border border-ochre bg-ochre px-6 py-3 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ochre-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load playlist"}
          </button>
        </form>
      </div>

      {error && <ToolErrorNotice error={error} />}

      {preview && !job && (
        <div className="mt-12">
          <h2 className="font-display text-[22px] font-bold leading-tight text-ink">
            {preview.title || "Playlist"}
          </h2>
          <p className="mt-2 font-body text-[15px] text-ink-soft">
            {!preview.capped
              ? `${preview.cappedCount} videos`
              : preview.totalCount > preview.cappedCount
                ? `First ${preview.cappedCount} of ${preview.totalCount} videos`
                : `First ${preview.cappedCount} videos`}
            {preview.totalDuration > 0 ? ` · ${fmtDuration(preview.totalDuration)} total` : ""}
          </p>
          {preview.capped && (
            <p className="mt-1 font-body text-[14px] italic text-ink-muted">
              Long playlists are capped: only the first {preview.cappedCount} videos will be
              processed.
            </p>
          )}

          <div className="mt-6">{processButton}</div>
          <p className="mt-3 max-w-[640px] font-body text-[14px] italic leading-[1.6] text-ink-muted">
            Processing warms every video&rsquo;s metadata, tags, thumbnail, and transcript so you
            can browse them and download the whole set as a report bundle. It runs in the
            background, so you can leave and come back.
          </p>

          <ol className="mt-8 divide-y divide-rule border-y border-rule">
            {preview.entries.map((e, i) => (
              <li
                key={`${e.videoId}-${i}`}
                className="flex items-center gap-3 py-2.5 font-body text-[15px] text-ink-soft"
              >
                <span className="w-7 shrink-0 text-right font-mono text-[12px] text-ink-muted">
                  {i + 1}
                </span>
                <span className="flex-1 truncate" title={e.title}>
                  {e.title || e.videoId}
                </span>
                {fmtDuration(e.duration) && (
                  <span className="shrink-0 font-mono text-[12px] text-ink-muted">
                    {fmtDuration(e.duration)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {job && (
        <div className="mt-12">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-[22px] font-bold leading-tight text-ink">
              {job.title || "Playlist"}
            </h2>
            <StatusPill status={job.status} />
          </div>

          <p className="mt-2 font-body text-[15px] text-ink-soft">
            {job.completed_videos} of {job.total_videos} done
            {job.failed_videos > 0 ? ` · ${job.failed_videos} failed` : ""}
            {job.status === "queued" && job.queuePosition > 0
              ? ` · ${job.queuePosition} videos queued ahead`
              : ""}
          </p>

          <div className="mt-3 h-2 w-full max-w-[520px] overflow-hidden border border-rule bg-paper">
            <div className="h-full bg-ochre transition-all" style={{ width: `${pct}%` }} />
          </div>

          {job.partial_reason === "quota_exhausted" && (
            <p className="mt-3 font-body text-[14px] italic text-ink-muted">
              Stopped early: today&rsquo;s lookup limit was reached, so the remaining videos were
              skipped.
            </p>
          )}
          {job.partial_reason === "not_entitled" && (
            <p className="mt-3 font-body text-[14px] italic text-ink-muted">
              Stopped early: the Supporter subscription is no longer active.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadAll}
              disabled={downloadingAll || job.completed_videos === 0}
              className="border border-ochre bg-ochre px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-paper transition-colors hover:bg-ochre-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloadingAll
                ? "Bundling…"
                : `Download all reports (${job.completed_videos})`}
            </button>
            {jobActive && (
              <button
                type="button"
                onClick={cancelJob}
                className="border border-rule px-5 py-3 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-crimson hover:text-crimson"
              >
                Cancel
              </button>
            )}
          </div>

          <ol className="mt-8 divide-y divide-rule border-y border-rule">
            {job.items.map((it) => (
              <li
                key={it.position}
                className="flex items-center gap-3 py-2.5 font-body text-[15px] text-ink-soft"
              >
                <span className="w-7 shrink-0 text-right font-mono text-[12px] text-ink-muted">
                  {it.position + 1}
                </span>
                <span className="flex-1 truncate" title={it.title}>
                  {it.status === "done" ? (
                    <Link
                      href={`/?url=${encodeURIComponent(`https://youtu.be/${it.video_id}`)}`}
                      className="text-ochre-deep underline decoration-1 underline-offset-2 hover:text-ochre"
                    >
                      {it.title || it.video_id}
                    </Link>
                  ) : (
                    it.title || it.video_id
                  )}
                </span>
                {fmtDuration(it.duration) && (
                  <span className="hidden shrink-0 font-mono text-[12px] text-ink-muted sm:inline">
                    {fmtDuration(it.duration)}
                  </span>
                )}
                <StatusPill status={it.status} />
              </li>
            ))}
          </ol>
        </div>
      )}

      <section
        className={`mt-20 border-t-2 border-rule-strong pt-12 ${hasResult ? "hidden" : ""}`}
      >
        <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          Every video in a playlist, in one pass
        </h2>
        <p className="mt-4 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          {"Researching a channel or a course means opening dozens of videos one at a time. Point this at a playlist and it pulls the metadata, tags, thumbnail, and full transcript for every video, then hands you the whole set as a report bundle you can read or feed to an LLM."}
        </p>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          How it works
        </h2>
        <ol className="mt-4 max-w-[720px] list-decimal space-y-2 pl-5 font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          <li>{"Paste a playlist link and select Load playlist to preview its videos for free."}</li>
          <li>{"Supporters start a background job that processes every video, paced to stay reliable."}</li>
          <li>{"Watch each video complete, open any one, or download all the reports as a single ZIP."}</li>
        </ol>

        <h2 className="mt-12 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink md:text-[32px]">
          Related tools
        </h2>
        <p className="mt-4 max-w-[720px] font-body text-[16px] leading-[1.75] text-ink-soft md:text-[17px]">
          {"For a single video, use the "}
          <Link href="/" className="text-ochre-deep underline hover:text-ochre">
            Overview
          </Link>
          {" or "}
          <Link href="/transcript" className="text-ochre-deep underline hover:text-ochre">
            Transcript
          </Link>
          {" tool. See "}
          <Link href="/pricing" className="text-ochre-deep underline hover:text-ochre">
            pricing
          </Link>
          {" for what Supporter includes."}
        </p>
      </section>
    </PageShell>
  );
}
