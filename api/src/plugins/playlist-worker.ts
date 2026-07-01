import crypto from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { canonicalUrl, extractYouTube, YouTubeError } from '../lib/youtube.js';
import { isProByEmail, chargeLookupQuota, type Entitlement } from '../lib/entitlement.js';

declare module 'fastify' {
  interface FastifyInstance {
    // notify() wakes THIS process's drain loop so a job submitted on this instance
    // starts promptly. On a non-leader replica the wake is a no-op and the leader
    // picks the job up on its next idle poll (IDLE_POLL_MS), so cross-replica start
    // is bounded by that poll rather than instant.
    playlistWorker: { notify: () => void };
  }
}

// Mirror the /api/youtube/extract cache exactly, so the videos this worker warms are
// served as cache HITs by that route (the client renders playlist results from them).
const EXTRACT_CACHE_PREFIX = 'youtube:extract:';
const EXTRACT_CACHE_TTL_S = 60 * 60 * 24 * 30; // 30 days

// Cluster-wide single-flight: only the lock holder processes, one video at a time, so
// the pacing that protects the shared IP holds regardless of how many replicas run.
const LEADER_KEY = 'playlist:worker:leader';
const LEADER_TTL_S = 30;
const LEADER_HEARTBEAT_MS = 10_000; // refresh well under the TTL, independent of the per-video await
const IDLE_POLL_MS = 10_000;
const SHUTDOWN_DRAIN_MS = 25_000; // bounded wait for the in-flight video on close (< stop_grace_period)

// Compare-and-{expire,delete}: only touch the lock if we still hold it, atomically, so
// a lapsed-then-reacquired lock is never extended or deleted out from under its holder.
const REFRESH_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";
const RELEASE_LUA =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

type JobRow = { id: string; email: string; status: string };
type ItemRow = { job_id: string; position: number; video_id: string };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function playlistWorker(fastify: FastifyInstance) {
  if (!config.playlist.enabled) {
    fastify.decorate('playlistWorker', { notify: () => {} });
    fastify.log.info('playlist worker disabled (PLAYLIST_ENABLED != true)');
    return;
  }

  const leaderToken = crypto.randomUUID();
  let draining = false;
  let wakeRequested = false;
  let closing = false;
  let pollTimer: NodeJS.Timeout | null = null;
  let activeDrain: Promise<void> | null = null;

  // ---- cluster leader lock (atomic, token-guarded) ----
  async function acquireLeader(): Promise<boolean> {
    try {
      return (await fastify.valkey.set(LEADER_KEY, leaderToken, 'EX', LEADER_TTL_S, 'NX')) === 'OK';
    } catch {
      return false;
    }
  }
  async function refreshLeader(): Promise<void> {
    try {
      await fastify.valkey.eval(REFRESH_LUA, 1, LEADER_KEY, leaderToken, String(LEADER_TTL_S * 1000));
    } catch {
      /* best-effort */
    }
  }
  async function releaseLeader(): Promise<void> {
    // Bounded so a black-holed Valkey call can never wedge the drain's finally.
    try {
      await Promise.race([
        fastify.valkey.eval(RELEASE_LUA, 1, LEADER_KEY, leaderToken),
        sleep(2000),
      ]);
    } catch {
      /* best-effort */
    }
  }

  // ---- item / job state transitions (each a single atomic, idempotent statement) ----
  async function markItemDone(item: ItemRow): Promise<void> {
    const r = await fastify.pg.query<{ n: number }>(
      `WITH upd AS (
         UPDATE playlist_job_items SET status='done'
         WHERE job_id=$1 AND position=$2 AND status='pending' RETURNING 1
       )
       UPDATE playlist_jobs
         SET completed_videos = completed_videos + (SELECT count(*) FROM upd), updated_at=NOW()
       WHERE id=$1
       RETURNING (SELECT count(*)::int FROM upd) AS n`,
      [item.job_id, item.position],
    );
    if ((r.rows[0]?.n ?? 0) > 0) fastify.metrics.playlistVideosTotal.inc({ result: 'done' });
  }

  async function markItemFailed(item: ItemRow, code: string): Promise<void> {
    const r = await fastify.pg.query<{ n: number }>(
      `WITH upd AS (
         UPDATE playlist_job_items SET status='failed', error=$3
         WHERE job_id=$1 AND position=$2 AND status='pending' RETURNING 1
       )
       UPDATE playlist_jobs
         SET failed_videos = failed_videos + (SELECT count(*) FROM upd), updated_at=NOW()
       WHERE id=$1
       RETURNING (SELECT count(*)::int FROM upd) AS n`,
      [item.job_id, item.position, code],
    );
    if ((r.rows[0]?.n ?? 0) > 0) fastify.metrics.playlistVideosTotal.inc({ result: 'failed' });
  }

  // Stop a job early (quota exhausted mid-run, or the owner's sub lapsed while queued):
  // skip whatever is left and finish partial. Idempotent via the status='running' guard.
  async function finishJobPartial(jobId: string, reason: string): Promise<void> {
    const skipped = await fastify.pg.query(
      `UPDATE playlist_job_items SET status='skipped' WHERE job_id=$1 AND status='pending'`,
      [jobId],
    );
    const res = await fastify.pg.query(
      `UPDATE playlist_jobs SET status='completed', partial_reason=$2, finished_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND status='running'`,
      [jobId, reason],
    );
    if (res.rowCount && res.rowCount > 0) {
      const n = skipped.rowCount ?? 0;
      for (let i = 0; i < n; i++) fastify.metrics.playlistVideosTotal.inc({ result: 'skipped' });
      fastify.metrics.playlistJobsTotal.inc({ status: 'completed' });
      fastify.log.info({ jobId, reason }, 'playlist job finished partial');
    }
  }

  // Complete a job once its last item lands. Atomic + idempotent: only a 'running' job
  // with zero pending items transitions, so it never double-counts.
  async function maybeFinishJob(jobId: string): Promise<void> {
    const res = await fastify.pg.query(
      `UPDATE playlist_jobs SET status='completed', finished_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND status='running'
         AND NOT EXISTS (SELECT 1 FROM playlist_job_items WHERE job_id=$1 AND status='pending')`,
      [jobId],
    );
    if (res.rowCount && res.rowCount > 0) {
      fastify.metrics.playlistJobsTotal.inc({ status: 'completed' });
    }
  }

  // ---- claim: least-recently-serviced active job's next pending item ----
  // Runs in a transaction with FOR UPDATE SKIP LOCKED so that, even if the leader lock
  // is ever briefly overlapped, two workers can never claim the same job's item.
  async function claimNextItem(): Promise<{ job: JobRow; item: ItemRow } | null> {
    const client = await fastify.pg.connect();
    try {
      await client.query('BEGIN');
      const jobRes = await client.query<JobRow>(
        `SELECT j.id, j.email, j.status FROM playlist_jobs j
         WHERE j.status IN ('queued','running')
           AND EXISTS (SELECT 1 FROM playlist_job_items i WHERE i.job_id=j.id AND i.status='pending')
         ORDER BY j.last_serviced_at ASC NULLS FIRST, j.created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
      );
      const job = jobRes.rows[0];
      if (!job) {
        await client.query('COMMIT');
        return null;
      }
      const itemRes = await client.query<ItemRow>(
        `SELECT job_id, position, video_id FROM playlist_job_items
         WHERE job_id=$1 AND status='pending' ORDER BY position ASC LIMIT 1`,
        [job.id],
      );
      const item = itemRes.rows[0];
      if (!item) {
        await client.query('COMMIT');
        return null;
      }
      await client.query(
        `UPDATE playlist_jobs SET status='running', started_at=COALESCE(started_at, NOW()),
           last_serviced_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [job.id],
      );
      await client.query('COMMIT');
      return { job, item };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // ---- process one video: cache-first, then charge-before-extract on a miss ----
  async function processItem(job: JobRow, item: ItemRow): Promise<void> {
    // Honor a cancel that arrived after this item was claimed.
    const fresh = await fastify.pg.query<{ status: string }>(
      `SELECT status FROM playlist_jobs WHERE id=$1`,
      [job.id],
    );
    if (fresh.rows[0]?.status !== 'running') return;

    const cacheKey = EXTRACT_CACHE_PREFIX + item.video_id;

    // Cache-first: a warm video costs nothing and never touches YouTube.
    let cached: string | null = null;
    try {
      cached = await fastify.valkey.get(cacheKey);
    } catch {
      cached = null;
    }
    if (cached) {
      await markItemDone(item);
      return;
    }

    // Miss → confirm entitlement, then charge quota BEFORE extracting.
    const isPro = await isProByEmail(fastify, job.email);
    if (isPro === null) {
      // The entitlement lookup itself failed (a transient Valkey/PG error). Do NOT
      // terminate a paid job over a blip — leave the item pending to retry next drain.
      return;
    }
    if (!isPro) {
      await finishJobPartial(job.id, 'not_entitled');
      return;
    }
    const ent: Entitlement = {
      identity: job.email,
      email: job.email,
      loggedIn: true,
      isPro: true,
      tier: 'pro',
    };
    const quota = await chargeLookupQuota(fastify, ent, item.video_id);
    if (!quota.allowed) {
      await finishJobPartial(job.id, 'quota_exhausted');
      return;
    }

    const result = await extractYouTube(canonicalUrl(item.video_id));
    try {
      await fastify.valkey.set(cacheKey, JSON.stringify(result), 'EX', EXTRACT_CACHE_TTL_S);
    } catch (err) {
      fastify.log.warn({ err }, 'playlist worker cache write failed');
    }
    await markItemDone(item);
  }

  // ---- the drain loop, guarded by the cluster lock ----
  async function drain(): Promise<void> {
    if (draining || closing) return;
    draining = true;
    let heartbeat: NodeJS.Timeout | null = null;
    try {
      if (!(await acquireLeader())) return; // another instance is the leader
      heartbeat = setInterval(() => void refreshLeader(), LEADER_HEARTBEAT_MS);
      for (;;) {
        if (closing) break;
        let claimed: { job: JobRow; item: ItemRow } | null = null;
        try {
          claimed = await claimNextItem();
        } catch (err) {
          fastify.log.error({ err }, 'playlist worker claim failed');
          break;
        }
        if (!claimed) break;

        try {
          await processItem(claimed.job, claimed.item);
        } catch (err) {
          // One bad video must never take down the loop or the process.
          const code = err instanceof YouTubeError ? err.code : 'error';
          fastify.log.warn(
            { err: err instanceof Error ? err.message : err, videoId: claimed.item.video_id },
            'playlist item failed',
          );
          await markItemFailed(claimed.item, code).catch((e) =>
            fastify.log.error({ err: e }, 'playlist worker markItemFailed failed'),
          );
        }
        await maybeFinishJob(claimed.job.id).catch((e) =>
          fastify.log.error({ err: e }, 'playlist worker maybeFinishJob failed'),
        );

        if (closing) break;
        await sleep(config.playlist.perVideoDelayMs);
      }
    } catch (err) {
      fastify.log.error({ err }, 'playlist worker drain failed');
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      // Reset draining BEFORE the (bounded) release so a slow release can never wedge
      // the loop; a concurrent tick just no-ops on acquireLeader until we release.
      draining = false;
      await releaseLeader();
      if (wakeRequested && !closing) {
        wakeRequested = false;
        setImmediate(scheduleTick);
      }
    }
  }

  function scheduleTick(): void {
    if (draining) {
      wakeRequested = true;
      return;
    }
    activeDrain = drain();
  }

  fastify.decorate('playlistWorker', { notify: scheduleTick });

  fastify.addHook('onReady', async () => {
    // Boot recovery for jobs an earlier process left mid-flight:
    //  - Jobs still 'queued'/'running' WITH pending items are re-claimed directly by
    //    claimNextItem (it selects both statuses), so they resume on their own.
    //  - A job whose items are ALL terminal but whose status never flipped (a crash
    //    between the last item and maybeFinishJob) would be stranded active forever;
    //    complete those here. This only ever touches jobs with zero pending items, so
    //    it cannot disturb a job another replica is actively processing.
    try {
      const res = await fastify.pg.query(
        `UPDATE playlist_jobs SET status='completed', finished_at=COALESCE(finished_at, NOW()), updated_at=NOW()
         WHERE status IN ('queued','running')
           AND NOT EXISTS (SELECT 1 FROM playlist_job_items i WHERE i.job_id=playlist_jobs.id AND i.status='pending')`,
      );
      if (res.rowCount && res.rowCount > 0) {
        // Count these completions like every other completion path (maybeFinishJob /
        // finishJobPartial), so the metric is not undercounted after a boot recovery.
        for (let i = 0; i < res.rowCount; i++) {
          fastify.metrics.playlistJobsTotal.inc({ status: 'completed' });
        }
        fastify.log.info({ completed: res.rowCount }, 'playlist worker completed stranded jobs on boot');
      }
    } catch (err) {
      fastify.log.warn({ err }, 'playlist worker boot recovery failed');
    }
    pollTimer = setInterval(() => scheduleTick(), IDLE_POLL_MS);
    scheduleTick();
  });

  fastify.addHook('onClose', async () => {
    closing = true;
    if (pollTimer) clearInterval(pollTimer);
    // Let the in-flight video finish (bounded) so the pg/valkey pools are not torn
    // down under it, which would drift counters and leave the leader key lingering.
    if (activeDrain) {
      await Promise.race([activeDrain, sleep(SHUTDOWN_DRAIN_MS)]).catch(() => {});
    }
  });
}

export const playlistWorkerPlugin = fp(playlistWorker, {
  name: 'playlist-worker',
  dependencies: ['postgres', 'valkey', 'metrics'],
});
