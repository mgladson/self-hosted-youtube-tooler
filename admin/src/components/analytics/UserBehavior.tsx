import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { PeriodSelector } from '@/components/ui/PeriodSelector';
import { MetricCard } from '@/components/analytics/MetricCard';
import { PageViewsChart } from '@/components/analytics/behavior/PageViewsChart';
import { ScrollDepthChart } from '@/components/analytics/behavior/ScrollDepthChart';
import { TopClickedElements } from '@/components/analytics/behavior/TopClickedElements';
import { TopPagesTable } from '@/components/analytics/behavior/TopPagesTable';
import { EngagementByPage } from '@/components/analytics/behavior/EngagementByPage';
import { ElementVisibilityRanking } from '@/components/analytics/behavior/ElementVisibilityRanking';
import { GeoDistribution } from '@/components/analytics/GeoDistribution';
import { DeviceDistribution } from '@/components/analytics/DeviceDistribution';
import { Eye, Users, Clock, ChevronDown } from '@/lib/icons';
import { TIME_PERIODS } from '@/lib/analytics';
import {
  fetchBehaviorAnalytics,
  fetchGeoAnalytics,
  fetchDeviceAnalytics,
  type BehaviorData,
  type GeoData,
  type DeviceData,
} from '@/lib/api';
import type { GeoCountry } from '@/lib/geo-data';

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

export function UserBehavior() {
  const [activePeriod, setActivePeriod] = useState('last-30');
  const [data, setData] = useState<BehaviorData | null>(null);
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [devices, setDevices] = useState<DeviceData | null>(null);
  const [pathFilter, setPathFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const period = TIME_PERIODS.find((p) => p.key === activePeriod)!;
  const [start, end] = useMemo(() => period.getDateRange(), [activePeriod]);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  useEffect(() => {
    setLoading(true);
    fetchBehaviorAnalytics(startISO, endISO)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [startISO, endISO]);

  useEffect(() => {
    fetchGeoAnalytics(startISO, endISO, pathFilter || undefined)
      .then(setGeo)
      .catch(() => setGeo(null));
    fetchDeviceAnalytics(startISO, endISO, pathFilter || undefined)
      .then(setDevices)
      .catch(() => setDevices(null));
  }, [startISO, endISO, pathFilter]);

  const pathOptions = useMemo(() => data?.topPages.map((p) => p.path) ?? [], [data]);

  const geoCountries: GeoCountry[] = useMemo(
    () =>
      (geo?.countries ?? []).map((c) => ({
        code: c.code,
        name: c.name,
        flag: c.flag,
        lat: c.lat,
        lng: c.lng,
        visitors: c.visitors,
        registered: c.registered,
        paid: c.paid,
        paying: c.paying,
        regions: c.regions ?? [],
      })),
    [geo],
  );

  if (loading) {
    return (
      <div className="py-12 text-center text-muted text-sm">Loading behavior data...</div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-muted text-sm">
        No behavior data available. Visit the storefront to generate tracking events.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <PeriodSelector
          periods={TIME_PERIODS.map((p) => ({ key: p.key, label: p.label }))}
          activePeriod={activePeriod}
          onChange={setActivePeriod}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard
          label="Total Page Views"
          value={data.summary.totalPageViews.toLocaleString()}
          icon={Eye}
        />
        <MetricCard
          label="Unique Sessions"
          value={data.summary.uniqueSessions.toLocaleString()}
          icon={Users}
        />
        <MetricCard
          label="Avg Time on Page"
          value={formatTime(data.summary.avgTimeOnPageMs)}
          icon={Clock}
        />
        <MetricCard
          label="Avg Scroll Depth"
          value={`${data.summary.avgScrollDepth}%`}
          icon={ChevronDown}
        />
      </div>

      <Card className="mb-6">
        <h2 className="font-semibold text-primary mb-4">Page Views Over Time</h2>
        <PageViewsChart data={data.pageViews} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="font-semibold text-primary mb-4">Scroll Depth Distribution</h2>
          <ScrollDepthChart data={data.scrollDepth} />
        </Card>
        <Card>
          <h2 className="font-semibold text-primary mb-4">Engagement by Page Type</h2>
          <EngagementByPage data={data.topPages} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="font-semibold text-primary mb-4">Top Clicked Elements</h2>
          <TopClickedElements data={data.topClicks} />
        </Card>
        <Card>
          <h2 className="font-semibold text-primary mb-4">Most Viewed Sections</h2>
          <ElementVisibilityRanking data={data.elementVisibility} />
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-primary mb-4">Top Pages</h2>
        <TopPagesTable data={data.topPages} />
      </Card>

      <GeoDistribution
        countries={geoCountries}
        pathOptions={pathOptions}
        pathFilter={pathFilter}
        onPathFilterChange={setPathFilter}
      />

      <DeviceDistribution
        data={devices}
        pathOptions={pathOptions}
        pathFilter={pathFilter}
        onPathFilterChange={setPathFilter}
      />
    </div>
  );
}
