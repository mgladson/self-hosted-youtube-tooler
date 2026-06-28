import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import {
  fetchSecurityDashboard,
  fetchSecurityReport,
  blockIp,
  unblockIp,
  type SecurityDashboard,
  type SecurityReport,
  type BannedIpEntry,
  type RecentBanEntry,
} from '@/lib/api';

const POLL_INTERVAL = 30_000;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function attackStatusColor(status: string): string {
  if (status === 'ATTACK') return 'bg-red-500/10 border border-red-500/40 text-red-400';
  if (status === 'ELEVATED') return 'bg-amber-500/10 border border-amber-500/40 text-amber-400';
  return 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400';
}

function attackStatusLabel(status: string): string {
  if (status === 'ATTACK') return 'UNDER ATTACK';
  if (status === 'ELEVATED') return 'ELEVATED THREAT';
  return 'NORMAL';
}

function scoreColor(score: number | null): string {
  if (score === null || score === undefined) return 'text-muted';
  if (score >= 0.85) return 'text-red-400 font-semibold';
  if (score >= 0.60) return 'text-amber-400';
  return 'text-emerald-400';
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-kbd-bg rounded-lg px-4 py-3">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-xl font-semibold text-primary">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// Shorten an ISO bucket string to "HH:mm" for chart labels
function shortBucket(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export function Security() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SecurityDashboard | null>(null);
  const [blockingIp, setBlockingIp] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(() => {
    fetchSecurityDashboard()
      .then((d) => {
        setData(d);
        setLastRefresh(new Date());
      })
      .catch(() => {
        toast('Failed to load security dashboard', 'error');
      })
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  const handleBlock = useCallback(
    async (ip: string, reason: string) => {
      setBlockingIp(ip);
      try {
        await blockIp(ip, reason);
        toast(`Blocked ${ip}`, 'success');
        load();
      } catch {
        toast(`Failed to block ${ip}`, 'error');
      } finally {
        setBlockingIp(null);
      }
    },
    [load, toast],
  );

  const handleBlockSubnet = useCallback(
    async (ip: string) => {
      // Derive /24 subnet from IPv4 address
      const parts = ip.split('.');
      if (parts.length !== 4) {
        toast('Block /24 only works for IPv4 addresses', 'error');
        return;
      }
      const subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
      await handleBlock(subnet, `Blocked /24 subnet from security dashboard (threat actor ${ip})`);
    },
    [handleBlock, toast],
  );

  const handleUnblock = useCallback(
    async (ip: string) => {
      setBlockingIp(ip);
      try {
        await unblockIp(ip);
        toast(`Unblocked ${ip}`, 'success');
        load();
      } catch {
        toast(`Failed to unblock ${ip}`, 'error');
      } finally {
        setBlockingIp(null);
      }
    },
    [load, toast],
  );

  const handleDownloadReport = useCallback(async () => {
    setDownloadingReport(true);
    try {
      const report: SecurityReport = await fetchSecurityReport();
      const csvLines: string[] = [
        'SECURITY REPORT',
        `Period: ${report.period.start} → ${report.period.end}`,
        `Generated: ${report.generatedAt}`,
        report.gdprNote,
        '',
        'SUMMARY',
        'Total Events,Blocked,Flagged,Unique IPs',
        `${report.summary.totalEvents},${report.summary.blocked},${report.summary.flagged},${report.summary.uniqueIps}`,
        '',
        'TOP THREAT ACTORS',
        'IP,Country,Total Req,Blocked Req,First Seen,Last Seen',
        ...(report.topThreatActors ?? []).map((r) =>
          `${r.ip},${r.country ?? ''},${r.totalReq},${r.blockedReq},${r.firstSeen},${r.lastSeen}`,
        ),
        '',
        'ACTIONABLE TASKS',
        'Severity,Task,Evidence,Action',
        ...(report.actionableTasks ?? []).map((t) =>
          [t.severity, t.task, t.evidence, t.action]
            .map((s) => `"${s.replace(/"/g, '""')}"`)
            .join(','),
        ),
      ];
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Failed to generate report', 'error');
    } finally {
      setDownloadingReport(false);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const status = data?.attackStatus ?? 'NORMAL';
  const stats = data?.stats ?? { counter429: 0, totalReq: 0, uniqueIps: 0, rate429Pct: 0 };
  const infraStats = data?.infraStats ?? { valkeyMemoryMb: 0, pgActiveConnections: 0 };
  const checkoutStats = data?.checkoutStats ?? { attemptsLast24h: 0, successLast24h: 0 };
  const authStats = data?.authStats ?? { recentBans: [], failedLoginsCount: 0 };
  const blockedBreakdown = data?.blockedBreakdown ?? { byReason: [], byCountry: [], byUaClass: [] };

  const checkoutSuccessPct =
    checkoutStats.attemptsLast24h > 0
      ? Math.round((checkoutStats.successLast24h / checkoutStats.attemptsLast24h) * 100)
      : 0;

  // Panel 2: Chart data
  const timelineChartData = (data?.eventTimeline ?? []).map((r) => ({
    time: shortBucket(r.bucket),
    Total: parseInt(r.total, 10),
    Blocked: parseInt(r.blocked, 10),
    Flagged: parseInt(r.flagged, 10),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Security</h1>
          <p className="text-sm text-muted mt-1">
            {lastRefresh
              ? `Last updated ${relativeTime(lastRefresh.toISOString())} · auto-refreshes every 30s`
              : 'Loading…'}
          </p>
        </div>
        <button
          onClick={handleDownloadReport}
          disabled={downloadingReport}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-surface-raised transition-colors disabled:opacity-50"
        >
          {downloadingReport ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          )}
          Download Report
        </button>
      </div>

      {data?.degraded && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-400">
          Running in degraded mode — security_events table not yet created. Historical data unavailable.
        </div>
      )}

      {/* Panel 1 — Attack Status Banner */}
      <div className={`rounded-xl px-6 py-5 ${attackStatusColor(status)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold tracking-wide">{attackStatusLabel(status)}</p>
            {data?.attackDurationMinutes != null && data.attackDurationMinutes > 0 && (
              <p className="text-sm mt-0.5 opacity-80">Duration: {data.attackDurationMinutes}m</p>
            )}
          </div>
          <div className="text-right text-sm opacity-80 space-y-0.5">
            <p>429 rate: <strong>{stats.rate429Pct}%</strong></p>
            <p>Unique IPs (60s): <strong>{stats.uniqueIps}</strong></p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total requests (60s)" value={stats.totalReq} />
        <StatCard label="Rate limited (60s)" value={stats.counter429} sub={`${stats.rate429Pct}% of traffic`} />
        <StatCard label="Unique IPs (60s)" value={stats.uniqueIps} />
        <StatCard label="Banned IPs" value={data?.bannedIps?.length ?? 0} />
      </div>

      {/* Panel 2 — Traffic Overview (hourly security events, last 24h) */}
      {timelineChartData.length > 0 && (
        <Card>
          <h2 className="font-semibold text-primary mb-4">Security Event Activity (last 24h)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={timelineChartData} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--color-muted, #888)' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted, #888)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface, #1a1a1a)', border: '1px solid var(--color-border, #333)', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: 'var(--color-primary, #eee)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Total" fill="#6366f1" opacity={0.7} radius={[2, 2, 0, 0]} />
              <Bar dataKey="Blocked" fill="#ef4444" opacity={0.8} radius={[2, 2, 0, 0]} />
              <Bar dataKey="Flagged" fill="#f59e0b" opacity={0.8} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Panel 3 — Top Threat Actors */}
      {data?.topThreatActors && data.topThreatActors.length > 0 && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-primary">Top Threat Actors (last 5 min)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-6 py-3">IP</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Requests</th>
                  <th className="px-4 py-3">Blocked</th>
                  <th className="px-4 py-3">Bot Score</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.topThreatActors.map((actor) => (
                  <tr key={actor.ip} className="border-b border-border last:border-0 hover:bg-kbd-bg/30">
                    <td className="px-6 py-3 font-mono text-xs text-primary">{actor.ip}</td>
                    <td className="px-4 py-3 text-muted">{actor.country ?? '—'}</td>
                    <td className="px-4 py-3">{actor.total_req}</td>
                    <td className="px-4 py-3 text-destructive">{actor.blocked_req}</td>
                    <td className={`px-4 py-3 ${scoreColor(parseFloat(actor.avg_bot_score))}`}>
                      {actor.avg_bot_score ? parseFloat(actor.avg_bot_score).toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleBlock(actor.ip, 'Blocked from security dashboard (threat actor)')}
                          disabled={blockingIp === actor.ip}
                          className="rounded px-2 py-1 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                        >
                          Block
                        </button>
                        {actor.ip.split('.').length === 4 && (
                          <button
                            onClick={() => handleBlockSubnet(actor.ip)}
                            disabled={blockingIp === actor.ip}
                            className="rounded px-2 py-1 text-xs bg-destructive/5 text-destructive/80 hover:bg-destructive/15 transition-colors disabled:opacity-50"
                            title="Block entire /24 subnet"
                          >
                            /24
                          </button>
                        )}
                        <button
                          onClick={() => handleUnblock(actor.ip)}
                          disabled={blockingIp === actor.ip}
                          className="rounded px-2 py-1 text-xs bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                        >
                          Unblock
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Panel 4 — Blocked Traffic Breakdown */}
      {(blockedBreakdown.byReason.length > 0 || blockedBreakdown.byCountry.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* By reason */}
          {blockedBreakdown.byReason.length > 0 && (
            <Card>
              <h2 className="font-semibold text-primary mb-3 text-sm">Blocked by Reason (24h)</h2>
              <div className="space-y-2">
                {blockedBreakdown.byReason.map((r) => (
                  <div key={r.event_type} className="flex items-center justify-between">
                    <span className="text-xs text-muted font-mono">{r.event_type}</span>
                    <Badge variant="destructive">{r.count}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {/* By country */}
          {blockedBreakdown.byCountry.length > 0 && (
            <Card>
              <h2 className="font-semibold text-primary mb-3 text-sm">Blocked by Country (24h)</h2>
              <div className="space-y-2">
                {blockedBreakdown.byCountry.slice(0, 8).map((r) => (
                  <div key={r.country} className="flex items-center justify-between">
                    <span className="text-xs text-muted">{r.country}</span>
                    <Badge variant="warning">{r.count}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {/* By UA class */}
          {blockedBreakdown.byUaClass.length > 0 && (
            <Card>
              <h2 className="font-semibold text-primary mb-3 text-sm">Blocked by UA Class (24h)</h2>
              <div className="space-y-2">
                {blockedBreakdown.byUaClass.map((r) => (
                  <div key={r.ua_class} className="flex items-center justify-between">
                    <span className="text-xs text-muted font-mono">{r.ua_class}</span>
                    <Badge variant="warning">{r.count}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Panel 5 — Rate Limit by Endpoint */}
      {data?.rateLimitByEndpoint && data.rateLimitByEndpoint.length > 0 && (
        <Card>
          <h2 className="font-semibold text-primary mb-4">Rate Limit Hits by Endpoint (24h)</h2>
          <div className="space-y-2">
            {data.rateLimitByEndpoint.map((r) => (
              <div key={r.endpoint} className="flex items-center justify-between py-1">
                <span className="font-mono text-xs text-primary">{r.endpoint}</span>
                <Badge variant="warning">{r.hits} hits</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Panel 6 — Bot Detection Feed */}
      {data?.recentEvents && data.recentEvents.length > 0 && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-primary">Bot Detection Feed</h2>
            <p className="text-xs text-muted mt-0.5">Events with bot score ≥ 0.50 in last 24h</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-6 py-3">Time</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-6 py-3">UA</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEvents.slice(0, 50).map((evt) => (
                  <tr key={evt.id} className="border-b border-border last:border-0 hover:bg-kbd-bg/30">
                    <td className="px-6 py-3 text-xs text-muted whitespace-nowrap">
                      {relativeTime(evt.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{evt.ip}</td>
                    <td className="px-4 py-3 text-muted">{evt.country ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={evt.event_type === 'honeypot' ? 'destructive' : 'warning'}>
                        {evt.event_type}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 ${scoreColor(evt.bot_score)}`}>
                      {evt.bot_score != null ? Number(evt.bot_score).toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={evt.action === 'blocked' ? 'destructive' : evt.action === 'flagged' ? 'warning' : 'default'}>
                        {evt.action ?? 'allowed'}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-xs text-muted max-w-[200px] truncate">
                      {evt.user_agent ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Panel 7 — Auth Attack Panel */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-primary">Auth Attack Panel</h2>
          <p className="text-xs text-muted mt-0.5">
            Failed logins (1h): <strong className="text-primary">{authStats.failedLoginsCount}</strong>
          </p>
        </div>
        {authStats.recentBans.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted">No recent ban or unblock events</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-6 py-3">Time</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-6 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {(authStats.recentBans as RecentBanEntry[]).map((b, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-kbd-bg/30">
                    <td className="px-6 py-3 text-xs text-muted whitespace-nowrap">
                      {relativeTime(b.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{b.ip_address}</td>
                    <td className="px-4 py-3">
                      <Badge variant={b.action === 'ban' ? 'destructive' : 'default'}>{b.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{b.user_email}</td>
                    <td className="px-6 py-3 text-xs text-muted max-w-[280px] truncate">{b.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Panel 7b — Banned IPs */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-primary">Banned IPs</h2>
            <p className="text-xs text-muted mt-0.5">
              {data?.bannedIps?.length ?? 0} IP{(data?.bannedIps?.length ?? 0) !== 1 ? 's' : ''} blocked
            </p>
          </div>
        </div>
        {!data?.bannedIps || data.bannedIps.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted">No banned IPs</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-6 py-3">IP</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Banned At</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data.bannedIps as BannedIpEntry[]).map((b) => (
                  <tr key={b.ip} className="border-b border-border last:border-0 hover:bg-kbd-bg/30">
                    <td className="px-6 py-3 font-mono text-xs text-primary">{b.ip}</td>
                    <td className="px-4 py-3 text-muted text-xs">{b.reason}</td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                      {relativeTime(b.bannedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleUnblock(b.ip)}
                        disabled={blockingIp === b.ip}
                        className="rounded px-2 py-1 text-xs bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                      >
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Panel 8 — Checkout / Business Impact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-semibold text-primary mb-3 text-sm">Checkout Impact (24h)</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Total attempts</span>
              <span className="font-semibold text-primary">{checkoutStats.attemptsLast24h}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Successful payments</span>
              <span className="font-semibold text-emerald-400">{checkoutStats.successLast24h}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Conversion rate</span>
              <span className={`font-semibold ${checkoutSuccessPct < 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {checkoutSuccessPct}%
              </span>
            </div>
            {checkoutStats.attemptsLast24h > 0 && checkoutSuccessPct < 10 && (
              <p className="text-xs text-amber-400 mt-2">
                ⚠ Low conversion may indicate card-testing activity
              </p>
            )}
          </div>
        </Card>

        {/* Panel 9 — Infrastructure Health */}
        <Card>
          <h2 className="font-semibold text-primary mb-3 text-sm">Infrastructure Health</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Valkey memory</span>
              <span className={`font-semibold ${infraStats.valkeyMemoryMb > 256 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {infraStats.valkeyMemoryMb > 0 ? `${infraStats.valkeyMemoryMb} MB` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">PG active connections</span>
              <span className={`font-semibold ${infraStats.pgActiveConnections > 80 ? 'text-red-400' : infraStats.pgActiveConnections > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {infraStats.pgActiveConnections}
              </span>
            </div>
            {infraStats.pgActiveConnections > 80 && (
              <p className="text-xs text-red-400 mt-2">
                ⚠ Connection count critical — consider PgBouncer
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
