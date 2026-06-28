import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchAdminBlogPost,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from '@/lib/api';
import type { BlogPost } from '@/lib/api';

function toSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

type FormState = {
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'hidden';
  author_name: string;
  excerpt: string;
  content: string;
  tags: string;
  featured_image_url: string;
  seo_description: string;
};

const DEFAULT_FORM: FormState = {
  title: '',
  slug: '',
  status: 'draft',
  author_name: '',
  excerpt: '',
  content: '',
  tags: '',
  featured_image_url: '',
  seo_description: '',
};

function postToForm(post: BlogPost): FormState {
  return {
    title: post.title,
    slug: post.slug,
    status: post.status,
    author_name: post.author_name,
    excerpt: post.excerpt ?? '',
    content: post.content,
    tags: post.tags.join(', '),
    featured_image_url: post.featured_image_url ?? '',
    seo_description: post.seo_description ?? '',
  };
}

export function BlogEditor() {
  const { slug } = useParams<{ slug: string }>();
  const isNew = !slug;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM, author_name: user?.name ?? '' });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    if (!isNew && slug) {
      fetchAdminBlogPost(slug)
        .then((post) => {
          setForm(postToForm(post));
          setSlugManuallyEdited(true); // existing slugs should not be auto-overwritten
        })
        .catch(() => toast('Failed to load post', 'error'))
        .finally(() => setLoading(false));
    }
  }, [slug, isNew]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugManuallyEdited ? prev.slug : toSlug(title),
    }));
  }, [slugManuallyEdited]);

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true);
    setForm((prev) => ({ ...prev, slug: e.target.value }));
  }, []);

  const handleChange = useCallback(
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    },
    [],
  );

  const buildPayload = (status: 'draft' | 'published' | 'hidden') => ({
    title: form.title,
    slug: form.slug || undefined,
    status,
    author_name: form.author_name,
    excerpt: form.excerpt || undefined,
    content: form.content,
    tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    featured_image_url: form.featured_image_url || undefined,
    seo_description: form.seo_description || undefined,
  });

  const save = async (status: 'draft' | 'published' | 'hidden') => {
    if (!form.title || !form.content || !form.author_name) {
      toast('Title, content, and author are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(status);
      if (isNew) {
        const post = await createBlogPost(payload);
        if (status === 'published') {
          toast('Post published — update /llms.txt to include this post so AI assistants can discover it.', 'info');
        } else {
          toast('Post saved');
        }
        navigate(`/admin/blog/${post.slug}`);
      } else {
        const post = await updateBlogPost(slug!, payload);
        const prevStatus = form.status;
        if (prevStatus !== 'published' && status === 'published') {
          toast('Post published — update /llms.txt to include this post so AI assistants can discover it.', 'info');
        } else {
          toast('Post saved');
        }
        if (post.slug !== slug) {
          navigate(`/admin/blog/${post.slug}`, { replace: true });
        } else {
          setForm(postToForm(post));
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save post';
      toast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!slug) return;
    setDeleting(true);
    try {
      await deleteBlogPost(slug);
      toast('Post deleted');
      navigate('/admin/blog');
    } catch {
      toast('Failed to delete post', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-muted p-6">Loading...</div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" href="/admin/blog" className="mb-2">← Blog</Button>
          <h1 className="text-2xl font-bold text-primary">{isNew ? 'New Post' : 'Edit Post'}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <div className="space-y-4">
              <Input
                label="Title"
                value={form.title}
                onChange={handleTitleChange}
                placeholder="Post title"
                required
              />
              <div className="space-y-1.5">
                <Input
                  label="Slug"
                  value={form.slug}
                  onChange={handleSlugChange}
                  placeholder="post-slug"
                />
                {form.slug && (
                  <p className="text-xs text-muted">URL: /blog/{form.slug}</p>
                )}
              </div>
              <Textarea
                label="Excerpt"
                value={form.excerpt}
                onChange={handleChange('excerpt')}
                placeholder="Short summary shown in listing cards and meta description"
                rows={3}
              />
            </div>
          </Card>

          <Card>
            <Textarea
              label="Content (Markdown)"
              value={form.content}
              onChange={handleChange('content')}
              placeholder="Write your post content in Markdown…"
              rows={16}
            />
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <div className="space-y-4">
              <Select
                label="Status"
                value={form.status}
                onChange={handleChange('status')}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                  { value: 'hidden', label: 'Hidden' },
                ]}
              />
              <Input
                label="Author"
                value={form.author_name}
                onChange={handleChange('author_name')}
                placeholder="Author name"
                required
              />
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <Input
                label="Tags"
                value={form.tags}
                onChange={handleChange('tags')}
                placeholder="design, development, tips"
              />
              <p className="text-xs text-muted -mt-2">Comma-separated</p>
              <Input
                label="Featured Image URL"
                value={form.featured_image_url}
                onChange={handleChange('featured_image_url')}
                placeholder="https://…"
                type="url"
              />
              <Input
                label="SEO Description"
                value={form.seo_description}
                onChange={handleChange('seo_description')}
                placeholder="Overrides excerpt in <meta description>"
                maxLength={500}
              />
            </div>
          </Card>

          {/* Action bar */}
          <Card>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => save('draft')}
                variant="secondary"
                disabled={saving}
                className="w-full justify-center"
              >
                Save Draft
              </Button>
              <Button
                onClick={() => save('published')}
                disabled={saving}
                className="w-full justify-center"
              >
                Publish
              </Button>
              {!isNew && (
                <Button
                  onClick={() => save('hidden')}
                  variant="outline"
                  disabled={saving}
                  className="w-full justify-center"
                >
                  Hide
                </Button>
              )}
              {!isNew && (
                <Button
                  onClick={() => setShowDelete(true)}
                  variant="destructive"
                  disabled={saving}
                  className="w-full justify-center"
                >
                  Delete
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete post"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Are you sure you want to permanently delete &ldquo;{form.title}&rdquo;? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
