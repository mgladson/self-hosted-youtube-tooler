import fs from 'node:fs';
import path from 'node:path';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { writeAuditLog } from '../lib/audit.js';

export type BlocklistEntry = {
  value: string;
  type: 'email' | 'domain';
  reason: string;
  addedAt: string;
};

export type SanctionsAuditContext = {
  adminEmail: string;
  ip: string;
};

export type SanctionsGuard = {
  /** Returns true if the email address (or its domain) is on the blocklist. */
  isBlocked: (email: string) => boolean;
  addEntry: (entry: Omit<BlocklistEntry, 'addedAt'>, audit: SanctionsAuditContext) => Promise<void>;
  removeEntry: (value: string, audit: SanctionsAuditContext) => Promise<boolean>;
  getList: () => BlocklistEntry[];
};

declare module 'fastify' {
  interface FastifyInstance {
    sanctions: SanctionsGuard;
  }
}

async function sanctionsGuard(fastify: FastifyInstance) {
  const blocklistPath = path.resolve(process.cwd(), '..', 'data', 'sanctions-blocklist.json');

  let entries: BlocklistEntry[] = [];
  let blockedEmails = new Set<string>();
  let blockedDomains = new Set<string>();

  async function loadBlocklist() {
    try {
      const raw = await fs.promises.readFile(blocklistPath, 'utf-8');
      entries = JSON.parse(raw);
      blockedEmails = new Set(
        entries.filter((e) => e.type === 'email').map((e) => e.value.toLowerCase()),
      );
      blockedDomains = new Set(
        entries.filter((e) => e.type === 'domain').map((e) => e.value.toLowerCase()),
      );
      fastify.log.info(
        `Sanctions blocklist loaded: ${blockedEmails.size} emails, ${blockedDomains.size} domains`,
      );
    } catch {
      entries = [];
      blockedEmails = new Set();
      blockedDomains = new Set();
    }
  }

  function isBlocked(email: string): boolean {
    const lower = email.toLowerCase();
    if (blockedEmails.has(lower)) return true;
    const domain = lower.split('@')[1];
    return domain ? blockedDomains.has(domain) : false;
  }

  async function saveBlocklist() {
    try {
      await fs.promises.writeFile(blocklistPath, JSON.stringify(entries, null, 2) + '\n');
    } catch (err) {
      fastify.log.error({ err }, 'Failed to write sanctions-blocklist.json');
    }
  }

  async function addEntry(entry: Omit<BlocklistEntry, 'addedAt'>, audit: SanctionsAuditContext) {
    const lower = entry.value.toLowerCase();
    if (entries.some((e) => e.value.toLowerCase() === lower)) return;
    const full: BlocklistEntry = { ...entry, value: lower, addedAt: new Date().toISOString() };
    await writeAuditLog(fastify, {
      userEmail: audit.adminEmail,
      userName: audit.adminEmail,
      action: 'sanctions_add',
      resourceType: 'sanctions',
      summary: `Added ${entry.type} "${lower}" to sanctions blocklist`,
      ip: audit.ip,
      newState: { type: entry.type, value: lower, reason: entry.reason },
    });
    entries.push(full);
    if (entry.type === 'email') blockedEmails.add(lower);
    else blockedDomains.add(lower);
    await saveBlocklist();
  }

  async function removeEntry(value: string, audit: SanctionsAuditContext): Promise<boolean> {
    const lower = value.toLowerCase();
    const removed = entries.filter((e) => e.value.toLowerCase() === lower);
    if (removed.length === 0) return false;
    await writeAuditLog(fastify, {
      userEmail: audit.adminEmail,
      userName: audit.adminEmail,
      action: 'sanctions_remove',
      resourceType: 'sanctions',
      summary: `Removed "${lower}" from sanctions blocklist`,
      ip: audit.ip,
      newState: { value: lower },
    });
    entries = entries.filter((e) => e.value.toLowerCase() !== lower);
    blockedEmails.delete(lower);
    blockedDomains.delete(lower);
    await saveBlocklist();
    return true;
  }

  await loadBlocklist();

  // Event-based file watch (no polling). Debounce reloads to coalesce rapid writes
  // (e.g., editor save sequences emit several events within milliseconds).
  let reloadTimer: NodeJS.Timeout | null = null;
  const scheduleReload = () => {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      loadBlocklist().catch((err) =>
        fastify.log.error({ err }, 'Failed to reload sanctions blocklist'),
      );
    }, 200);
  };

  let watcher: fs.FSWatcher | null = null;
  try {
    watcher = fs.watch(blocklistPath, { persistent: false }, () => scheduleReload());
    watcher.on('error', (err) => {
      fastify.log.warn({ err }, 'sanctions blocklist watcher error');
    });
  } catch (err) {
    fastify.log.warn({ err }, 'failed to attach sanctions blocklist watcher');
  }

  fastify.addHook('onClose', () => {
    if (reloadTimer) clearTimeout(reloadTimer);
    if (watcher) watcher.close();
  });

  fastify.decorate('sanctions', {
    isBlocked,
    addEntry,
    removeEntry,
    getList: () => [...entries],
  });
}

export const sanctionsPlugin = fp(sanctionsGuard, { name: 'sanctions', dependencies: ['postgres'] });
