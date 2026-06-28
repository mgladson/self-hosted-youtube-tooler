import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Table, type Column } from '@/components/ui/Table';
import { StickyActionBar } from '@/components/ui/StickyActionBar';
import { useToast } from '@/components/ui/Toast';
import { getCollectionBySlug, getCollectionProducts, type Product } from '@/lib/mock-data';
import { formatPrice, toSlug } from '@/lib/utils';

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  draft: 'warning',
  archived: 'default',
};

const productColumns: Column<Product>[] = [
  {
    key: 'product',
    header: 'Product',
    render: (p) => (
      <div className="flex items-center gap-3">
        <img src={p.images[0]} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
        <span className="font-medium">{p.name}</span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (p) => (
      <Badge variant={statusVariant[p.status]}>
        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
      </Badge>
    ),
  },
  {
    key: 'price',
    header: 'Price',
    render: (p) => formatPrice(p.price),
  },
];

export function CollectionDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const collection = getCollectionBySlug(slug || '');

  const [form, setForm] = useState(() => {
    if (!collection) return null;
    return {
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      image: collection.image,
    };
  });
  const [dirty, setDirty] = useState(false);

  const update = (patch: Partial<NonNullable<typeof form>>) => {
    setForm((prev) => prev ? { ...prev, ...patch } : prev);
    setDirty(true);
  };

  if (!collection || !form) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-primary mb-2">Collection not found</h2>
        <Button variant="secondary" href="/admin/collections">Back to Collections</Button>
      </div>
    );
  }

  const products = getCollectionProducts(collection.id);

  const handleSave = () => {
    toast('Collection saved successfully');
    setDirty(false);
  };

  const handleDiscard = () => {
    navigate('/admin/collections');
  };

  const handleDelete = () => {
    toast('Collection deleted', 'success');
    navigate('/admin/collections');
  };

  return (
    <div className="pb-20">
      <Breadcrumbs items={[
        { label: 'Collections', href: '/admin/collections' },
        { label: collection.name },
      ]} />

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-primary">{collection.name}</h1>
        {collection.featured && <Badge variant="accent">Featured</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="font-semibold text-primary mb-4">Collection Info</h2>
            <div className="space-y-4">
              <Input
                label="Name"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <div>
                <Input
                  label="URL Slug"
                  value={form.slug}
                  onChange={(e) => update({ slug: toSlug(e.target.value) })}
                />
                <p className="text-xs text-muted mt-1.5">
                  findcarehelper.com/collections/{form.slug}
                </p>
              </div>
              <Textarea
                label="Description"
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
              />
              <Input
                label="Image URL"
                value={form.image}
                onChange={(e) => update({ image: e.target.value })}
              />
            </div>
          </Card>

          <Card padding={false}>
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-primary">Products in Collection ({products.length})</h2>
            </div>
            <Table
              columns={productColumns}
              data={products}
              rowKey={(p) => p.id}
              onRowClick={(p) => navigate(`/admin/products/${p.slug}`)}
              emptyMessage="No products in this collection"
            />
          </Card>
        </div>

        <div>
          <Card>
            <h2 className="font-semibold text-primary mb-4">Preview</h2>
            <img
              src={collection.image}
              alt={collection.name}
              className="w-full rounded-lg object-cover aspect-[16/9]"
            />
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
