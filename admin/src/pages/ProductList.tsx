import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, type Column, type SortDirection } from '@/components/ui/Table';
import { BulkActionsBar } from '@/components/ui/BulkActionsBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Plus, Search, Download, Package } from '@/lib/icons';
import { useProducts } from '@/lib/hooks';
import { getCategories, type Product } from '@/lib/mock-data';
import { formatPrice, formatDate, cn } from '@/lib/utils';
import { downloadCSV, centsToDollars, formatISODate } from '@/lib/csv';

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  draft: 'warning',
  archived: 'default',
};

const PAGE_SIZE = 25;

const columns: Column<Product>[] = [
  {
    key: 'product',
    header: 'Product',
    render: (p) => (
      <div className="flex items-center gap-3">
        <img
          src={p.images[0]}
          alt={p.name}
          className="h-10 w-10 rounded-lg object-cover"
        />
        <div>
          <p className="font-medium">{p.name}</p>
          <p className="text-xs text-muted">{p.category}</p>
        </div>
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
    sortable: true,
    sortValue: (p) => p.price,
    render: (p) => (
      <div>
        <span className="font-medium">{formatPrice(p.price)}</span>
        {p.compareAtPrice && (
          <span className="ml-2 text-xs text-muted line-through">{formatPrice(p.compareAtPrice)}</span>
        )}
      </div>
    ),
  },
  {
    key: 'type',
    header: 'File Type',
    render: (p) => <span className="text-muted">{p.fileType}</span>,
  },
  {
    key: 'date',
    header: 'Created',
    sortable: true,
    sortValue: (p) => new Date(p.createdAt).getTime(),
    render: (p) => <span className="text-muted">{formatDate(p.createdAt)}</span>,
  },
];

export function ProductList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const categories = ['All', ...getCategories()];
  const { products: allProducts, total: allTotal } = useProducts(
    search || category !== 'All'
      ? { search: search || undefined, category: category !== 'All' ? category : undefined }
      : undefined,
  );

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return allProducts;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return allProducts;
    const list = [...allProducts];
    list.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [allProducts, sortKey, sortDir]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
    setSelectedIds([]);
  }, []);

  const handleCategoryChange = useCallback((cat: string) => {
    setCategory(cat);
    setPage(1);
    setSortKey(undefined);
    setSortDir(null);
    setSelectedIds([]);
  }, []);

  const handleSortChange = useCallback((key: string, dir: SortDirection) => {
    setSortKey(dir ? key : undefined);
    setSortDir(dir);
    setPage(1);
    setSelectedIds([]);
  }, []);

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    setSelectedIds([]);
  }, []);

  if (allTotal === 0 && !search && category === 'All') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">Products</h1>
            <p className="text-sm text-muted mt-1">Manage your digital products</p>
          </div>
        </div>
        <Card>
          <EmptyState
            icon={Package}
            heading="No products yet"
            description="Add your first digital product to get started."
            actionLabel="Add Product"
            actionHref="/admin/products/new"
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Products</h1>
          <p className="text-sm text-muted mt-1">Manage your digital products</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            downloadCSV('products.csv', [
              { key: 'name', header: 'Name', value: (p: Product) => p.name },
              { key: 'category', header: 'Category', value: (p: Product) => p.category },
              { key: 'price', header: 'Price (USD)', value: (p: Product) => centsToDollars(p.price) },
              { key: 'compare', header: 'Compare At (USD)', value: (p: Product) => p.compareAtPrice ? centsToDollars(p.compareAtPrice) : '' },
              { key: 'cost', header: 'Cost (USD)', value: (p: Product) => centsToDollars(p.cost) },
              { key: 'status', header: 'Status', value: (p: Product) => p.status },
              { key: 'type', header: 'File Type', value: (p: Product) => p.fileType },
              { key: 'created', header: 'Created', value: (p: Product) => formatISODate(p.createdAt) },
            ], allProducts);
          }}>
            <Download size={14} />
            Export CSV
          </Button>
          <Button href="/admin/products/new">
            <Plus size={16} />
            Add Product
          </Button>
        </div>
      </div>

      <BulkActionsBar
        selectedIds={selectedIds}
        actions={[{ label: 'Export selected', onClick: () => {} }]}
        onClear={() => setSelectedIds([])}
      />

      <Card padding={false}>
        <div className="p-4 space-y-4 border-b border-border">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 max-w-sm">
            <Search size={16} className="text-muted" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="bg-transparent text-sm text-primary placeholder:text-muted-foreground focus:outline-none flex-1"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  category === cat
                    ? 'bg-accent text-white'
                    : 'bg-kbd-bg text-muted hover:bg-skeleton',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <Table
          columns={columns}
          data={paged}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/admin/products/${p.slug}`)}
          emptyMessage="No products found"
          selectable
          onSelectionChange={setSelectedIds}
          sortKey={sortKey}
          sortDirection={sortDir}
          onSortChange={handleSortChange}
          page={page}
          pageSize={PAGE_SIZE}
          total={allProducts.length}
          onPageChange={handlePageChange}
        />
      </Card>
    </div>
  );
}
