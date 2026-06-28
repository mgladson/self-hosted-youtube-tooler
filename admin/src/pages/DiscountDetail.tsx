import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft } from '@/lib/icons';
import { getDiscountById, type Discount } from '@/lib/mock-data';
import { formatPrice } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function DiscountDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === 'new' || !id;
  const existing = isNew ? null : getDiscountById(id);

  const [code, setCode] = useState(existing?.code || '');
  const [type, setType] = useState<Discount['type']>(existing?.type || 'percentage');
  const [value, setValue] = useState(existing ? String(existing.value) : '');
  const [minOrder, setMinOrder] = useState(existing?.minOrderAmount ? String(existing.minOrderAmount / 100) : '');
  const [maxUses, setMaxUses] = useState(existing?.maxUses ? String(existing.maxUses) : '');
  const [startsAt, setStartsAt] = useState(existing?.startsAt || new Date().toISOString().split('T')[0]);
  const [endsAt, setEndsAt] = useState(existing?.endsAt || '');
  const [active, setActive] = useState(existing?.active ?? true);

  if (!isNew && !existing) {
    return (
      <div>
        <Link to="/admin/discounts" className="flex items-center gap-2 text-sm text-muted hover:text-primary mb-6">
          <ArrowLeft size={16} />
          Back to Discounts
        </Link>
        <Card>
          <p className="text-center text-muted py-8">Discount not found</p>
        </Card>
      </div>
    );
  }

  const handleSave = () => {
    toast(isNew ? 'Discount created' : 'Discount updated', 'success');
    navigate('/admin/discounts');
  };

  const displayValue = type === 'percentage'
    ? `${value || 0}% off`
    : formatPrice(Number(value || 0));

  return (
    <div>
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 mb-6 text-sm text-yellow-800">
        Preview — discounts are not yet active in checkout
      </div>

      <Link to="/admin/discounts" className="flex items-center gap-2 text-sm text-muted hover:text-primary mb-6">
        <ArrowLeft size={16} />
        Back to Discounts
      </Link>

      <h1 className="text-2xl font-bold text-primary mb-6">
        {isNew ? 'Create discount' : `Edit ${existing!.code}`}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-primary mb-4">Discount code</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SAVE10"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <Button variant="outline" size="sm" onClick={() => setCode(randomCode())}>
                Generate
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-primary mb-4">Type and value</h2>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={type === 'percentage'}
                  onChange={() => setType('percentage')}
                  className="text-accent focus:ring-accent"
                />
                <span className="text-sm">Percentage</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={type === 'fixed_amount'}
                  onChange={() => setType('fixed_amount')}
                  className="text-accent focus:ring-accent"
                />
                <span className="text-sm">Fixed amount</span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                min={0}
                className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <span className="text-sm text-muted">{type === 'percentage' ? '%' : '$'}</span>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-primary mb-4">Conditions</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted mb-1">Minimum order amount (optional)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">$</span>
                  <input
                    type="number"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    placeholder="0.00"
                    min={0}
                    className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Maximum total uses (optional)</label>
                <input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="Unlimited"
                  min={0}
                  className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-primary mb-4">Active dates</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">Start date</label>
                <input
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">End date (optional)</label>
                <input
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-primary mb-4">Summary</h2>
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-accent">{displayValue}</p>
                <p className="text-xs text-muted mt-1">
                  {code ? <span className="font-mono">{code}</span> : 'No code set'}
                </p>
              </div>
              <div className="border-t border-border pt-3 space-y-1.5">
                {minOrder && (
                  <p className="text-xs text-muted">Min order: ${minOrder}</p>
                )}
                {maxUses && (
                  <p className="text-xs text-muted">Max uses: {maxUses}</p>
                )}
                <p className="text-xs text-muted">
                  Starts: {startsAt || 'Not set'}
                </p>
                {endsAt && (
                  <p className="text-xs text-muted">Ends: {endsAt}</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-primary mb-4">Status</h2>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">{active ? 'Active' : 'Inactive'}</span>
              <button
                onClick={() => setActive(!active)}
                className={`relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-accent' : 'bg-skeleton'}`}
              >
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${active ? 'translate-x-5' : ''}`} />
              </button>
            </label>
            {!isNew && existing && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted">
                  Uses: {existing.currentUses}{existing.maxUses ? ` / ${existing.maxUses}` : ''}
                </p>
              </div>
            )}
          </Card>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave}>
              {isNew ? 'Create discount' : 'Save changes'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/discounts')}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
