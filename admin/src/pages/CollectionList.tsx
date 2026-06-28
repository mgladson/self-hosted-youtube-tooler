import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Search, ChevronRight } from '@/lib/icons';
import { getCollections, getCollectionProducts } from '@/lib/mock-data';

const PAGE_SIZE = 9;

export function CollectionList() {
  const allCollections = getCollections();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return allCollections;
    const q = search.toLowerCase();
    return allCollections.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [allCollections, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Collections</h1>
          <p className="text-sm text-muted mt-1">Organize your products into collections</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 max-w-sm">
          <Search size={16} className="text-muted" />
          <input
            type="text"
            placeholder="Search collections..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-transparent text-sm text-primary placeholder:text-muted-foreground focus:outline-none flex-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {paged.map((collection) => {
          const productCount = getCollectionProducts(collection.id).length;
          return (
            <Link key={collection.id} to={`/admin/collections/${collection.slug}`}>
              <Card padding={false} className="overflow-hidden hover:shadow-md transition-shadow group">
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={collection.image}
                    alt={collection.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-white font-semibold text-lg">{collection.name}</h3>
                    <p className="text-white/80 text-sm">{productCount} products</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted line-clamp-2">{collection.description}</p>
                  <div className="mt-3">
                    {collection.featured && <Badge variant="accent">Featured</Badge>}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-muted">No collections match your search</div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm">
          <span className="text-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
