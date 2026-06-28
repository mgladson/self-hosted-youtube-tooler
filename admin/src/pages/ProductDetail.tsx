import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { StickyActionBar } from '@/components/ui/StickyActionBar';
import { SEOPreview } from '@/components/products/SEOPreview';
import { useToast } from '@/components/ui/Toast';
import { getProductBySlug, getCategories } from '@/lib/mock-data';
import { formatDate, toSlug } from '@/lib/utils';

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  draft: 'warning',
  archived: 'default',
};

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const product = getProductBySlug(slug || '');

  const [form, setForm] = useState(() => {
    if (!product) return null;
    return {
      name: product.name,
      slug: product.slug,
      description: product.description,
      longDescription: product.longDescription,
      price: String(product.price / 100),
      compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice / 100) : '',
      category: product.category,
      tags: product.tags.join(', '),
      fileType: product.fileType,
      fileSize: product.fileSize,
      status: product.status,
      featured: product.featured,
    };
  });

  const [dirty, setDirty] = useState(false);
  const [primaryImage, setPrimaryImage] = useState(0);

  if (!product || !form) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-primary mb-2">Product not found</h2>
      </div>
    );
  }

  const categoryOptions = getCategories().map((c) => ({ value: c, label: c }));

  const update = (patch: Partial<typeof form>) => {
    setForm({ ...form, ...patch });
    setDirty(true);
  };

  const handleSave = () => {
    toast('Product saved successfully');
    setDirty(false);
  };

  const handleDiscard = () => {
    navigate('/admin/products');
  };

  const handleDelete = () => {
    toast('Product deleted', 'success');
    navigate('/admin/products');
  };

  return (
    <div className="pb-20">
      <Breadcrumbs items={[
        { label: 'Products', href: '/admin/products' },
        { label: product.name },
      ]} />

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-primary">{product.name}</h1>
        <Badge variant={statusVariant[product.status]}>
          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="font-semibold text-primary mb-4">Product Information</h2>
            <div className="space-y-4">
              <Input
                label="Name"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <Textarea
                label="Description"
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
              />
              <Textarea
                label="Long Description"
                value={form.longDescription}
                onChange={(e) => update({ longDescription: e.target.value })}
                className="min-h-[150px]"
              />
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-4">Media</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {product.images.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={img}
                    alt=""
                    className={`w-full aspect-square rounded-lg object-cover border-2 ${
                      i === primaryImage ? 'border-accent' : 'border-border'
                    }`}
                  />
                  {i !== primaryImage && (
                    <button
                      onClick={() => { setPrimaryImage(i); setDirty(true); }}
                      className="absolute bottom-1 left-1 right-1 rounded bg-black/70 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Set as primary
                    </button>
                  )}
                  {i === primaryImage && (
                    <span className="absolute top-1 left-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-white font-medium">
                      Primary
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted">Click or drag to upload images</p>
              <p className="text-xs text-muted mt-1">PNG, JPG up to 10MB</p>
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-4">Pricing</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Price ($)"
                type="number"
                value={form.price}
                onChange={(e) => update({ price: e.target.value })}
              />
              <Input
                label="Compare at Price ($)"
                type="number"
                value={form.compareAtPrice}
                onChange={(e) => update({ compareAtPrice: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-4">Organization</h2>
            <div className="space-y-4">
              <Select
                label="Category"
                options={categoryOptions}
                value={form.category}
                onChange={(e) => update({ category: e.target.value })}
              />
              <Input
                label="Tags"
                value={form.tags}
                onChange={(e) => update({ tags: e.target.value })}
                placeholder="Comma-separated tags"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="File Type"
                  value={form.fileType}
                  onChange={(e) => update({ fileType: e.target.value })}
                />
                <Input
                  label="File Size"
                  value={form.fileSize}
                  onChange={(e) => update({ fileSize: e.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4">
              <Input
                label="URL Slug"
                value={form.slug}
                onChange={(e) => update({ slug: toSlug(e.target.value) })}
              />
              <p className="text-xs text-muted mt-1.5">
                findcarehelper.com/products/{form.slug}
              </p>
            </div>
            <SEOPreview
              title={form.name}
              slug={form.slug}
              description={form.description}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-primary mb-4">Status</h2>
            <div className="space-y-4">
              <Select
                label="Product Status"
                options={statusOptions}
                value={form.status}
                onChange={(e) => update({ status: e.target.value as typeof form.status })}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => update({ featured: e.target.checked })}
                  className="rounded border-border text-accent focus:ring-accent/30"
                />
                <span className="text-sm text-primary">Featured product</span>
              </label>
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-3">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Created</dt>
                <dd className="text-primary">{formatDate(product.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Rating</dt>
                <dd className="text-primary">{product.rating} ({product.reviewCount} reviews)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">ID</dt>
                <dd className="text-primary font-mono text-xs">{product.id}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <StickyActionBar
        dirty={dirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onDelete={handleDelete}
      />
    </div>
  );
}
