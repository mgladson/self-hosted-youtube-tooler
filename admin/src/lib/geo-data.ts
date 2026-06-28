export type GeoRegion = {
  name: string;
  visitors: number;
  registered: number;
  paid: number;
  paying: number;
};

export type GeoCountry = {
  code: string;
  name: string;
  flag: string;
  lat: number;
  lng: number;
  visitors: number;
  registered: number;
  paid: number;
  paying: number;
  regions: GeoRegion[];
};

export type GeoMetric = 'visitors' | 'registered' | 'paid' | 'paying';

export const METRIC_LABELS: Record<GeoMetric, string> = {
  visitors: 'Visitors',
  registered: 'Registered Users',
  paid: 'Paid Customers',
  paying: 'Paying Now',
};

export const METRIC_COLORS: Record<GeoMetric, string> = {
  visitors: '#6366f1',
  registered: '#10b981',
  paid: '#f59e0b',
  paying: '#a855f7',
};

export function getTotalByMetric(countries: GeoCountry[], metric: GeoMetric): number {
  return countries.reduce((sum, c) => sum + c[metric], 0);
}
