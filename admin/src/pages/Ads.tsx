import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { fetchAdsConfig, updateAdsConfig, type AdsConfig, type DirectAd } from '@/lib/api';

const PLACEMENT_LABELS: Record<string, string> = {
  homepage_banner: 'Homepage — Banner (below hero)',
  homepage_in_feed: 'Homepage — In-feed (product grid)',
  collection_banner: 'Collection — Banner (below header)',
  collection_in_grid: 'Collection — In-grid',
  product_below_fold: 'Product Detail — Below the fold',
  blog_list_in_feed: 'Blog List — Between articles',
  blog_post_below_content: 'Blog Post — Below content',
  search_banner: 'Search — Banner (below search bar)',
  search_in_grid: 'Search — In-grid results',
  cart_bottom: 'Cart — Bottom section',
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        role="switch"
        aria-checked={checked}
        aria-label={label}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-skeleton'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-surface transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </div>
      <span className="text-sm font-medium text-primary">{label}</span>
    </label>
  );
}

function emptyDirectAd(): DirectAd {
  return {
    id: crypto.randomUUID(),
    placement: 'homepage_banner',
    imageUrl: '',
    linkUrl: '',
    altText: '',
    startDate: '',
    endDate: '',
  };
}

export function Ads() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [config, setConfig] = useState<AdsConfig | null>(null);

  const load = () => {
    setLoading(true);
    setError(false);
    fetchAdsConfig()
      .then(setConfig)
      .catch(() => {
        toast('Failed to load ads config', 'error');
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await updateAdsConfig(config);
      setConfig(updated);
      toast('Ads configuration saved');
    } catch {
      toast('Failed to save ads config', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Functional updater to avoid stale closure bugs
  const u = (fn: (prev: AdsConfig) => Partial<AdsConfig>) =>
    setConfig((prev) => (prev ? { ...prev, ...fn(prev) } : prev));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-muted">Failed to load advertising configuration.</p>
        <Button onClick={load} variant="secondary" size="sm">Retry</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Advertising</h1>
          <p className="text-sm text-muted mt-1">Configure ad placements and providers</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Master Switch */}
        <Card>
          <h2 className="font-semibold text-primary mb-4">Master Switch</h2>
          <Toggle
            checked={config.enabled}
            onChange={(enabled) => u(() => ({ enabled }))}
            label={config.enabled ? 'Ads are enabled' : 'Ads are disabled (all placements off)'}
          />
          {!config.enabled && (
            <p className="mt-3 text-sm text-muted">
              Enable the master switch to activate ad placements. Individual placements can be toggled below.
            </p>
          )}
        </Card>

        {/* Placements */}
        <Card>
          <h2 className="font-semibold text-primary mb-4">Placements</h2>
          <div className="space-y-3">
            {Object.entries(PLACEMENT_LABELS).map(([key, label]) => (
              <Toggle
                key={key}
                checked={config.placements[key] ?? false}
                onChange={(v) =>
                  u((prev) => ({ placements: { ...prev.placements, [key]: v } }))
                }
                label={label}
              />
            ))}
          </div>
        </Card>

        {/* Providers */}
        <Card>
          <h2 className="font-semibold text-primary mb-4">Ad Providers</h2>
          <div className="space-y-6">
            {/* Google AdSense */}
            <div className="space-y-3 p-4 rounded-lg bg-background border border-border">
              <Toggle
                checked={config.providers.googleAdsense.enabled}
                onChange={(enabled) =>
                  u((prev) => ({
                    providers: {
                      ...prev.providers,
                      googleAdsense: { ...prev.providers.googleAdsense, enabled },
                    },
                  }))
                }
                label="Google AdSense"
              />
              {config.providers.googleAdsense.enabled && (
                <div className="space-y-3 pl-14">
                  <Input
                    label="Client ID (ca-pub-...)"
                    value={config.providers.googleAdsense.clientId}
                    onChange={(e) => {
                      const clientId = e.target.value;
                      u((prev) => ({
                        providers: {
                          ...prev.providers,
                          googleAdsense: { ...prev.providers.googleAdsense, clientId },
                        },
                      }));
                    }}
                    placeholder="ca-pub-1234567890"
                  />
                  <Toggle
                    checked={config.providers.googleAdsense.autoAds}
                    onChange={(autoAds) =>
                      u((prev) => ({
                        providers: {
                          ...prev.providers,
                          googleAdsense: { ...prev.providers.googleAdsense, autoAds },
                        },
                      }))
                    }
                    label="Auto Ads"
                  />
                </div>
              )}
            </div>

            {/* Media.net */}
            <div className="space-y-3 p-4 rounded-lg bg-background border border-border">
              <Toggle
                checked={config.providers.mediaNet.enabled}
                onChange={(enabled) =>
                  u((prev) => ({
                    providers: {
                      ...prev.providers,
                      mediaNet: { ...prev.providers.mediaNet, enabled },
                    },
                  }))
                }
                label="Media.net"
              />
              {config.providers.mediaNet.enabled && (
                <div className="space-y-3 pl-14">
                  <Input
                    label="Customer ID"
                    value={config.providers.mediaNet.customerId}
                    onChange={(e) => {
                      const customerId = e.target.value;
                      u((prev) => ({
                        providers: {
                          ...prev.providers,
                          mediaNet: { ...prev.providers.mediaNet, customerId },
                        },
                      }));
                    }}
                    placeholder="8CU..."
                  />
                  <Input
                    label="Widget ID"
                    value={config.providers.mediaNet.widgetId}
                    onChange={(e) => {
                      const widgetId = e.target.value;
                      u((prev) => ({
                        providers: {
                          ...prev.providers,
                          mediaNet: { ...prev.providers.mediaNet, widgetId },
                        },
                      }));
                    }}
                    placeholder="123456"
                  />
                </div>
              )}
            </div>

            {/* Custom Direct */}
            <div className="space-y-3 p-4 rounded-lg bg-background border border-border">
              <Toggle
                checked={config.providers.customDirect.enabled}
                onChange={(enabled) =>
                  u((prev) => ({
                    providers: {
                      ...prev.providers,
                      customDirect: { ...prev.providers.customDirect, enabled },
                    },
                  }))
                }
                label="Custom / Direct-Sold Ads"
              />
            </div>
          </div>
        </Card>

        {/* Settings */}
        <Card>
          <h2 className="font-semibold text-primary mb-4">Settings</h2>
          <div className="space-y-4">
            <Toggle
              checked={config.settings.respectDoNotTrack}
              onChange={(respectDoNotTrack) =>
                u((prev) => ({ settings: { ...prev.settings, respectDoNotTrack } }))
              }
              label="Respect Do Not Track (DNT) header"
            />
            <Toggle
              checked={config.settings.lazyLoad}
              onChange={(lazyLoad) =>
                u((prev) => ({ settings: { ...prev.settings, lazyLoad } }))
              }
              label="Lazy load ads (IntersectionObserver)"
            />
            <div className="flex items-center gap-6">
              <Input
                label="In-feed: show ad every N items"
                type="number"
                value={String(config.settings.inFeedEveryN)}
                onChange={(e) => {
                  const inFeedEveryN = Math.max(2, parseInt(e.target.value) || 6);
                  u((prev) => ({ settings: { ...prev.settings, inFeedEveryN } }));
                }}
                className="w-32"
              />
              <Input
                label="In-grid: show ad every N items"
                type="number"
                value={String(config.settings.inGridEveryN)}
                onChange={(e) => {
                  const inGridEveryN = Math.max(2, parseInt(e.target.value) || 8);
                  u((prev) => ({ settings: { ...prev.settings, inGridEveryN } }));
                }}
                className="w-32"
              />
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Checkout:</strong> Ads are always disabled on the checkout page. This cannot be overridden.
              </p>
            </div>
          </div>
        </Card>

        {/* Direct Ads */}
        {config.providers.customDirect.enabled && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-primary">Direct-Sold Ads</h2>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  u((prev) => ({ directAds: [...prev.directAds, emptyDirectAd()] }))
                }
              >
                + Add Ad
              </Button>
            </div>
            {config.directAds.length === 0 ? (
              <p className="text-sm text-muted">No direct ads configured.</p>
            ) : (
              <div className="space-y-4">
                {config.directAds.map((ad, i) => (
                  <div key={ad.id} className="p-4 rounded-lg bg-background border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-primary">Ad #{i + 1}</span>
                      <button
                        onClick={() =>
                          u((prev) => ({ directAds: prev.directAds.filter((_, j) => j !== i) }))
                        }
                        className="text-xs text-muted hover:text-destructive transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-muted mb-1">Placement</label>
                        <select
                          value={ad.placement}
                          onChange={(e) => {
                            const placement = e.target.value;
                            u((prev) => {
                              const ads = [...prev.directAds];
                              ads[i] = { ...ads[i], placement };
                              return { directAds: ads };
                            });
                          }}
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
                        >
                          {Object.entries(PLACEMENT_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <Input
                        label="Image URL"
                        value={ad.imageUrl}
                        onChange={(e) => {
                          const imageUrl = e.target.value;
                          u((prev) => {
                            const ads = [...prev.directAds];
                            ads[i] = { ...ads[i], imageUrl };
                            return { directAds: ads };
                          });
                        }}
                        placeholder="https://..."
                      />
                      <Input
                        label="Link URL"
                        value={ad.linkUrl}
                        onChange={(e) => {
                          const linkUrl = e.target.value;
                          u((prev) => {
                            const ads = [...prev.directAds];
                            ads[i] = { ...ads[i], linkUrl };
                            return { directAds: ads };
                          });
                        }}
                        placeholder="https://..."
                      />
                      <Input
                        label="Alt Text"
                        value={ad.altText}
                        onChange={(e) => {
                          const altText = e.target.value;
                          u((prev) => {
                            const ads = [...prev.directAds];
                            ads[i] = { ...ads[i], altText };
                            return { directAds: ads };
                          });
                        }}
                        placeholder="Description of the ad"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Start Date"
                          type="date"
                          value={ad.startDate ? ad.startDate.slice(0, 10) : ''}
                          onChange={(e) => {
                            const startDate = e.target.value;
                            u((prev) => {
                              const ads = [...prev.directAds];
                              ads[i] = { ...ads[i], startDate };
                              return { directAds: ads };
                            });
                          }}
                        />
                        <Input
                          label="End Date"
                          type="date"
                          value={ad.endDate ? ad.endDate.slice(0, 10) : ''}
                          onChange={(e) => {
                            const endDate = e.target.value;
                            u((prev) => {
                              const ads = [...prev.directAds];
                              ads[i] = { ...ads[i], endDate };
                              return { directAds: ads };
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
