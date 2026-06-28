import type { FastifyInstance } from 'fastify';
import { meetsMinTier } from '../plugins/auth-guard.js';
import { writeAuditLog } from '../lib/audit.js';
import { getClientIp } from '../lib/client-ip.js';

// The admin "Commit" button triggers the "Sync Admin Data → Git" workflow
// (.github/workflows/sync-admin-data.yml) on demand. That workflow reads the
// live prod admin state and commits data/{current-employees,agencies,invoices}.json
// plus the workflow dropdowns to main, so a fresh deploy can be seeded from git.
// We fire it via GitHub's workflow_dispatch API rather than running git in this
// container (the api runs as a non-root user with no repo credentials), which
// also keeps the single, proven commit path the scheduled sync already uses.
//
// Auth uses WORKFLOW_SYNC_PAT — the same classic PAT (repo + workflow scope)
// the sync workflow's commit step uses. We reuse it (rather than a dedicated
// GITHUB_-prefixed var) because GitHub forbids secret names starting with
// GITHUB_. Dispatching only needs the `repo` scope; the token carries the
// broader push scope because it's shared with the workflow's commit step.
const GITHUB_API = 'https://api.github.com';
const DEFAULT_REPO = 'Block-Farms/self-hosted-bermese-employment-agency';
const WORKFLOW_FILE = 'sync-admin-data.yml';

export async function adminSyncRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/admin/commit-to-git — dispatch the backup-to-git workflow.
  // Restricted to admin+ tier: this writes a commit to the repo's main branch,
  // which is more privileged than the editor-tier content mutations.
  fastify.post('/api/admin/commit-to-git', async (request, reply) => {
    const user = request.session?.user;
    if (!user || user.role !== 'admin' || !meetsMinTier(user.adminTier, 'admin')) {
      return reply.status(403).send({ error: 'Only admins can sync to GitHub.' });
    }

    const token = process.env.WORKFLOW_SYNC_PAT;
    if (!token) {
      fastify.log.error('WORKFLOW_SYNC_PAT is not set; cannot dispatch sync workflow.');
      return reply.status(500).send({ error: 'GitHub sync is not configured on the server.' });
    }
    const repo = process.env.SYNC_REPO_SLUG || DEFAULT_REPO;

    try {
      const ghRes = await fetch(
        `${GITHUB_API}/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'findcarehelper-admin',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main' }),
        },
      );

      // A successful workflow_dispatch returns 204 No Content.
      if (ghRes.status !== 204) {
        const detail = await ghRes.text().catch(() => '');
        fastify.log.error({ status: ghRes.status, detail }, 'GitHub workflow dispatch rejected');
        return reply
          .status(502)
          .send({ error: `GitHub rejected the sync request (HTTP ${ghRes.status}).` });
      }
    } catch (err) {
      fastify.log.error({ err }, 'GitHub workflow dispatch request failed');
      return reply.status(502).send({ error: 'Could not reach GitHub to start the sync.' });
    }

    writeAuditLog(fastify, {
      userEmail: user.email,
      userName: user.name,
      action: 'create',
      resourceType: 'git-sync',
      summary: `Triggered GitHub backup sync to main (${WORKFLOW_FILE})`,
      ip: getClientIp(request),
    }).catch((err) => fastify.log.error({ err }, 'audit write failed'));

    return reply.status(202).send({ status: 'started' });
  });
}
