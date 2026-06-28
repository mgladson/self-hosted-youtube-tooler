import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Trash, Pencil } from '@/lib/icons';
import { fetchAdminBlogPosts, deleteBlogPost } from '@/lib/api';
import type { BlogPost } from '@/lib/api';

type StatusFilter = 'all' | 'published' | 'draft' | 'hidden';

const STATUS_BADGE: Record<BlogPost['status'], { variant: 'success' | 'warning' | 'destructive'; label: string }> = {
  published: { variant: 'success', label: 'Published' },
  draft: { variant: 'warning', label: 'Draft' },
  hidden: { variant: 'destructive', label: 'Hidden' },
};

export function BlogList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAdminBlogPosts()
      .then((data) => setPosts(data.posts))
      .catch(() => toast('Failed to load blog posts', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = statusFilter === 'all' ? posts : posts.filter((p) => p.status === statusFilter);

  const handleDelete = async () => {
    if (!deleteSlug) return;
    setDeleting(true);
    try {
      await deleteBlogPost(deleteSlug);
      setPosts((prev) => prev.filter((p) => p.slug !== deleteSlug));
      toast('Post deleted');
      setDeleteSlug(null);
    } catch {
      toast('Failed to delete post', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'published', label: 'Published' },
    { key: 'draft', label: 'Draft' },
    { key: 'hidden', label: 'Hidden' },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Blog</h1>
          <p className="text-sm text-muted mt-1">Manage blog posts</p>
        </div>
        <Button href="/admin/blog/new">New Post</Button>
      </div>

      <div className="flex gap-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === tab.key
                ? 'bg-accent text-accent-foreground'
                : 'text-muted hover:text-primary hover:bg-hover-bg'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="p-6 text-sm text-muted">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted">No posts found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Author</th>
                <th className="px-4 py-3 text-left">Published</th>
                <th className="px-4 py-3 text-left">Tags</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((post) => {
                const badge = STATUS_BADGE[post.status];
                return (
                  <tr key={post.slug} className="hover:bg-hover-bg transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/admin/blog/${post.slug}`)}
                        className="font-medium text-primary hover:text-accent transition-colors text-left"
                      >
                        {post.title}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={badge.variant} dot>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-4 text-muted">{post.author_name}</td>
                    <td className="px-4 py-4 text-muted">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-4">
                      {post.tags.slice(0, 2).map((t) => (
                        <span key={t} className="mr-1 inline-block rounded-full bg-kbd-bg px-2 py-0.5 text-xs text-muted">{t}</span>
                      ))}
                      {post.tags.length > 2 && (
                        <span className="text-xs text-muted">+{post.tags.length - 2} more</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/admin/blog/${post.slug}`)}
                          className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteSlug(post.slug)}
                          className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!deleteSlug}
        onClose={() => setDeleteSlug(null)}
        title="Delete post"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteSlug(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Are you sure you want to permanently delete this post? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
