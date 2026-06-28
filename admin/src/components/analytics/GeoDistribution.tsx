import { useState, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import {
  type GeoCountry,
  type GeoMetric,
  METRIC_LABELS,
  METRIC_COLORS,
  getTotalByMetric,
} from '@/lib/geo-data';
import worldData from '@/lib/world-110m.json';

const MAP_W = 800;
const MAP_H = 400;

function project(lng: number, lat: number): [number, number] {
  return [(lng + 180) / 360 * MAP_W, (90 - lat) / 180 * MAP_H];
}

// Natural Earth 1:110m countries, public domain. Properties stripped; coords
// rounded to 2dp (sub-pixel at this viewBox). 177 features, projected once.
type Ring = [number, number][];
type GeoGeometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

function ringToPath(ring: Ring): string {
  let out = '';
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    out += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return out + 'Z';
}

function geometryToPath(geom: GeoGeometry): string {
  if (geom.type === 'Polygon') return geom.coordinates.map(ringToPath).join('');
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat().map(ringToPath).join('');
  return '';
}

const COUNTRY_PATHS: string[] = (worldData as unknown as { features: { geometry: GeoGeometry }[] }).features
  .map((f) => geometryToPath(f.geometry));

const GRATICULE_LATS = [-60, -30, 0, 30, 60];
const GRATICULE_LNGS = [-120, -60, 0, 60, 120];

type TooltipState = {
  country: GeoCountry;
  x: number;
  y: number;
};

type MetricTab = { key: GeoMetric; label: string };

const METRIC_TABS: MetricTab[] = [
  { key: 'visitors', label: 'Visitors' },
  { key: 'registered', label: 'Registered' },
  { key: 'paid', label: 'Paid' },
  { key: 'paying', label: 'Paying' },
];

type Props = {
  countries: GeoCountry[];
  pathOptions?: string[];
  pathFilter?: string;
  onPathFilterChange?: (path: string) => void;
};

export function GeoDistribution({ countries, pathOptions, pathFilter, onPathFilterChange }: Props) {
  const [metric, setMetric] = useState<GeoMetric>('visitors');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sorted = [...countries].sort((a, b) => b[metric] - a[metric]);
  const maxVal = sorted[0]?.[metric] || 1;
  const total = getTotalByMetric(countries, metric);
  const color = METRIC_COLORS[metric];

  const handleCircleEnter = useCallback((e: React.MouseEvent, country: GeoCountry) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ country, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const tooltipCountry = tooltip?.country;
  const hoveredCircle = tooltipCountry
    ? (() => {
        const [cx, cy] = project(tooltipCountry.lng, tooltipCountry.lat);
        const r = 5 + (tooltipCountry[metric] / maxVal) * 20;
        return { cx, cy, r };
      })()
    : null;

  return (
    <Card className="mt-6">
      {/* Header + filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-primary">Geographic Distribution</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {onPathFilterChange && pathOptions && pathOptions.length > 0 && (
            <select
              value={pathFilter ?? ''}
              onChange={(e) => onPathFilterChange(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-md bg-surface border border-border text-primary"
            >
              <option value="">All pages</option>
              {pathOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            {METRIC_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMetric(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  metric === key
                    ? 'text-white'
                    : 'text-muted hover:text-primary hover:bg-hover-bg'
                }`}
                style={metric === key ? { backgroundColor: color } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {countries.length === 0 ? (
        <div className="py-12 text-center text-muted text-sm">
          No geographic data yet. Visitors will appear here once tracking events are received.
        </div>
      ) : (
        <>
      {/* Map */}
      <div ref={containerRef} className="relative rounded-lg overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="w-full"
          style={{ background: '#0d1b2a', display: 'block' }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Graticule lines */}
          {GRATICULE_LATS.map((lat) => {
            const y = (90 - lat) / 180 * MAP_H;
            return (
              <line key={`lat${lat}`} x1={0} y1={y} x2={MAP_W} y2={y}
                stroke="#152232" strokeWidth={lat === 0 ? 1 : 0.5} />
            );
          })}
          {GRATICULE_LNGS.map((lng) => {
            const x = (lng + 180) / 360 * MAP_W;
            return (
              <line key={`lng${lng}`} x1={x} y1={0} x2={x} y2={MAP_H}
                stroke="#152232" strokeWidth={lng === 0 ? 1 : 0.5} />
            );
          })}

          {/* Country fills */}
          {COUNTRY_PATHS.map((d, i) => (
            <path key={i} d={d} fill="#162840" stroke="#1d3554" strokeWidth={0.3} />
          ))}

          {/* Country bubbles — render behind hovered ring */}
          {countries.map((country) => {
            const [cx, cy] = project(country.lng, country.lat);
            const val = country[metric];
            const r = 5 + (val / maxVal) * 20;
            const opacity = 0.2 + (val / maxVal) * 0.65;
            return (
              <circle
                key={country.code}
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                fillOpacity={opacity}
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.85}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => handleCircleEnter(e, country)}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}

          {/* Hovered ring */}
          {hoveredCircle && (
            <circle
              cx={hoveredCircle.cx}
              cy={hoveredCircle.cy}
              r={hoveredCircle.r + 4}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1.5}
              strokeOpacity={0.55}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 pointer-events-none bg-surface border border-border rounded-xl shadow-xl p-3 w-52"
            style={{
              left: Math.min(tooltip.x + 14, (containerRef.current?.clientWidth ?? 400) - 216),
              top: Math.max(tooltip.y - 90, 8),
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl leading-none">{tooltip.country.flag}</span>
              <span className="font-semibold text-primary text-sm leading-tight">{tooltip.country.name}</span>
            </div>
            <div className="space-y-1.5">
              {METRIC_TABS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span
                    className="text-xs"
                    style={{ color: metric === key ? METRIC_COLORS[key] : undefined }}
                  >
                    {metric === key ? <strong>{label}</strong> : <span className="text-muted">{label}</span>}
                  </span>
                  <span
                    className="text-xs font-semibold tabular-nums"
                    style={{ color: metric === key ? METRIC_COLORS[key] : 'inherit' }}
                  >
                    {tooltip.country[key].toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            {tooltip.country.regions.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-border">
                <p className="text-xs text-muted mb-1.5">Top regions</p>
                {[...tooltip.country.regions]
                  .sort((a, b) => b[metric] - a[metric])
                  .slice(0, 3)
                  .map((r) => (
                    <div key={r.name} className="flex items-center justify-between">
                      <span className="text-xs text-muted truncate max-w-[7rem]">{r.name}</span>
                      <span className="text-xs font-medium text-primary tabular-nums">
                        {r[metric].toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Country rankings */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-primary">
            Top Countries — {METRIC_LABELS[metric]}
          </p>
          <p className="text-xs text-muted tabular-nums">
            Total: <span className="font-medium text-primary">{total.toLocaleString()}</span>
          </p>
        </div>

        <div className="space-y-1">
          {sorted.slice(0, 10).map((country, idx) => {
            const val = country[metric];
            const barPct = (val / maxVal) * 100;
            const sharePct = total > 0 ? (val / total) * 100 : 0;
            const isExpanded = expanded === country.code;
            const topRegions = [...country.regions].sort((a, b) => b[metric] - a[metric]);
            const hasRegions = topRegions.length > 0;

            return (
              <div key={country.code}>
                <button
                  className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover-bg transition-colors text-left"
                  onClick={() => hasRegions && setExpanded(isExpanded ? null : country.code)}
                >
                  <span className="text-xs text-muted w-4 shrink-0 text-right">{idx + 1}</span>
                  <span className="text-base shrink-0 leading-none">{country.flag}</span>
                  <span className="text-sm font-medium text-primary w-28 shrink-0 truncate">{country.name}</span>
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${barPct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-primary w-16 text-right shrink-0 tabular-nums">
                    {val.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted w-10 text-right shrink-0 tabular-nums">
                    {sharePct.toFixed(1)}%
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''} ${hasRegions ? 'text-muted' : 'text-transparent'}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isExpanded && hasRegions && (
                  <div className="ml-[3.25rem] mt-0.5 mb-1 space-y-1">
                    {topRegions.map((region) => {
                      const rVal = region[metric];
                      const rBarPct = (rVal / val) * 100;
                      const rSharePct = total > 0 ? (rVal / total) * 100 : 0;
                      return (
                        <div key={region.name} className="flex items-center gap-2 py-0.5">
                          <span className="text-xs text-muted w-28 shrink-0 truncate">{region.name}</span>
                          <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${rBarPct}%`, backgroundColor: color, opacity: 0.55 }}
                            />
                          </div>
                          <span className="text-xs font-medium text-primary w-16 text-right shrink-0 tabular-nums">
                            {rVal.toLocaleString()}
                          </span>
                          <span className="text-xs text-muted w-10 text-right shrink-0 tabular-nums">
                            {rSharePct.toFixed(1)}%
                          </span>
                          <span className="w-3.5 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
        </>
      )}
    </Card>
  );
}
