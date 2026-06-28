import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { getCategories } from '@/lib/mock-data';
import { toSlug } from '@/lib/utils';

export function ProductCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    longDescription: '',
    price: '',
    compareAtPrice: '',
    category: 'UI Kits',
    tags: '',
    fileType: '',
    fileSize: '',
    status: 'draft',
  });
  const [slugLocked, setSlugLocked] = useState(false);

  const categoryOptions = getCategories().map((c) => ({ value: c, label: c }));
  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
  ];

  const handleCreate = () => {
    if (!form.name || !form.price || !form.slug) {
      toast('Please fill in required fields', 'error');
      return;
    }
    toast('Product created successfully');
    navigate('/admin/products');
  };

  return (
    <div>
      <Breadcrumbs items={[
        { label: 'Products', href: '/admin/products' },
        { label: 'New Product' },
      ]} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary">New Product</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/products')}>Cancel</Button>
          <Button onClick={handleCreate}>Create Product</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="font-semibold text-primary mb-4">Product Information</h2>
            <div className="space-y-4">
              <Input
                label="Name"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm({ ...form, name, slug: slugLocked ? form.slug : toSlug(name) });
                }}
                placeholder="e.g. Premium Dashboard UI Kit"
              />
              <div>
                <Input
                  label="URL Slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugLocked(true);
                    setForm({ ...form, slug: toSlug(e.target.value) });
                  }}
                  placeholder="e.g. premium-dashboard-ui-kit"
                />
                <p className="text-xs text-muted mt-1.5">
                  findcarehelper.com/products/{form.slug || '…'}
                  {slugLocked && form.name && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        onClick={() => {
                          setSlugLocked(false);
                          setForm({ ...form, slug: toSlug(form.name) });
                        }}
                        className="text-accent hover:underline"
                      >
                        Reset to suggested
                      </button>
                    </>
                  )}
                </p>
              </div>
              <Textarea
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief product description"
              />
              <Textarea
                label="Long Description"
                value={form.longDescription}
                onChange={(e) => setForm({ ...form, longDescription: e.target.value })}
                placeholder="Detailed product description"
                className="min-h-[150px]"
              />
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-4">Pricing</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Price ($)"
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="49.00"
              />
              <Input
                label="Compare at Price ($)"
                type="number"
                value={form.compareAtPrice}
                onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
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
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <Input
                label="Tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="figma, ui-kit, dashboard"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="File Type"
                  value={form.fileType}
                  onChange={(e) => setForm({ ...form, fileType: e.target.value })}
                  placeholder="e.g. Figma"
                />
                <Input
                  label="File Size"
                  value={form.fileSize}
                  onChange={(e) => setForm({ ...form, fileSize: e.target.value })}
                  placeholder="e.g. 24 MB"
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-primary mb-4">Status</h2>
            <Select
              label="Product Status"
              options={statusOptions}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            />
          </Card>

          <Card>
            <h2 className="font-semibold text-primary mb-4">Product Image</h2>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted mb-2">Drag and drop or click to upload</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
