import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { fetchBanner, updateBanner } from '@/lib/api';

export function Banner() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');

  useEffect(() => {
    fetchBanner()
      .then((data) => {
        setActive(data.active);
        setText(data.text);
        setImageUrl(data.imageUrl);
        setLinkUrl(data.linkUrl);
        setLinkLabel(data.linkLabel);
      })
      .catch(() => {
        toast('Failed to load banner settings', 'error');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateBanner({ active, text, imageUrl, linkUrl, linkLabel });
      toast('Banner saved successfully');
    } catch {
      toast('Failed to save banner', 'error');
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Promotional Banner</h1>
          <p className="text-sm text-muted mt-1">Configure the storefront promotional banner</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <h2 className="font-semibold text-primary mb-4">Banner Settings</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                role="switch"
                aria-checked={active}
                tabIndex={0}
                onClick={() => setActive(!active)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActive(!active);
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  active ? 'bg-accent' : 'bg-skeleton'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-surface transition-transform ${
                    active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-primary">
                {active ? 'Banner is active' : 'Banner is inactive'}
              </span>
            </label>

            <Textarea
              label="Banner Text"
              placeholder="🎉 Spring Sale! 20% off all templates with code SPRING20"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              className="min-h-[60px]"
            />
            <Input
              label="Image URL (optional)"
              placeholder="https://example.com/promo-image.png"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <Input
              label="Link URL (optional)"
              placeholder="/products or https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <Input
              label="Link Label (optional)"
              placeholder="Shop Now"
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-primary mb-4">Preview</h2>
          {active && text ? (
            <div className="rounded-lg overflow-hidden">
              <div className="bg-amber-600 px-4 py-3 flex items-center justify-center gap-3">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-5 w-5 rounded object-cover shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <p className="text-sm font-medium text-white text-center">{text}</p>
                {linkUrl && (
                  <span className="text-sm font-semibold text-white underline underline-offset-2 shrink-0">
                    {linkLabel || 'Learn More'}
                  </span>
                )}
                <span className="text-white/70 ml-2 shrink-0 text-xs">✕</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center">
              <p className="text-sm text-muted">
                {active ? 'Enter banner text above to see a preview' : 'Banner is currently inactive'}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
