import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { fetchPages, updatePage } from '@/lib/api';

type PageEntry = {
  slug: string;
  title: string;
  underConstruction: boolean;
  saving: boolean;
};

const PAGE_TITLES: Record<string, string> = {
  'privacy-policy': 'Privacy Policy',
  'terms-of-service': 'Terms of Service',
  'refund-policy': 'Refund Policy',
  'changelog': 'Changelog',
  'roadmap': 'Roadmap',
};

const KNOWN_SLUGS = Object.keys(PAGE_TITLES);

export function Pages() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<PageEntry[]>([]);

  useEffect(() => {
    fetchPages()
      .then((data) => {
        setPages(
          KNOWN_SLUGS.map((slug) => ({
            slug,
            title: PAGE_TITLES[slug],
            underConstruction: data.pages[slug]?.underConstruction ?? false,
            saving: false,
          })),
        );
      })
      .catch(() => {
        toast('Failed to load page settings', 'error');
        setPages(
          KNOWN_SLUGS.map((slug) => ({
            slug,
            title: PAGE_TITLES[slug],
            underConstruction: false,
            saving: false,
          })),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (slug: string, current: boolean) => {
    setPages((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, saving: true } : p)),
    );
    try {
      await updatePage(slug, !current);
      setPages((prev) =>
        prev.map((p) =>
          p.slug === slug ? { ...p, underConstruction: !current, saving: false } : p,
        ),
      );
      toast(`"${PAGE_TITLES[slug]}" updated`);
    } catch {
      toast('Failed to update page', 'error');
      setPages((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, saving: false } : p)),
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Pages</h1>
        <p className="text-sm text-muted mt-1">
          Toggle storefront pages to show an "Under Construction" placeholder
        </p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <h2 className="font-semibold text-primary mb-4">Page Visibility</h2>
          <div className="divide-y divide-border">
            {pages.map((page) => (
              <div key={page.slug} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-primary">{page.title}</p>
                  <p className="text-xs text-muted">/{page.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  {page.underConstruction && (
                    <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                      Under Construction
                    </span>
                  )}
                  <button
                    disabled={page.saving}
                    onClick={() => handleToggle(page.slug, page.underConstruction)}
                    className="relative inline-flex shrink-0 cursor-pointer items-center"
                    aria-label={`Toggle under construction for ${page.title}`}
                  >
                    <div
                      role="switch"
                      aria-checked={page.underConstruction}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        page.saving ? 'opacity-50' : ''
                      } ${page.underConstruction ? 'bg-amber-500' : 'bg-skeleton'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-surface transition-transform ${
                          page.underConstruction ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
