import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

type Review = {
  id: number;
  product_id: string;
  email: string;
  name: string;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
};

type StatusFilter = 'all' | ReviewStatus;

const STATUS_BADGE: Record<ReviewStatus, { variant: 'warning' | 'success' | 'destructive'; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'destructive', label: 'Rejected' },
};

async function fetchAdminReviews(status: StatusFilter): Promise<{ reviews: Review[] }> {
  const params = status === 'all' ? 'status=all' : `status=${status}`;
  const res = await fetch(`${API_BASE}/admin/reviews?${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Reviews fetch failed: ${res.status}`);
  return res.json();
}

async function updateReviewStatus(id: number, status: 'approved' | 'rejected'): Promise<Review> {
  const res = await fetch(`${API_BASE}/admin/reviews/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return res.json();
}

export function Reviews() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAdminReviews(statusFilter)
      .then((data) => setReviews(data.reviews))
      .catch(() => toast('Failed to load reviews', 'error'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const handleUpdateStatus = async (id: number, status: 'approved' | 'rejected') => {
    setUpdatingId(id);
    try {
      const updated = await updateReviewStatus(id, status);
      setReviews((prev) =>
        statusFilter === 'all'
          ? prev.map((r) => (r.id === id ? updated : r))
          : prev.filter((r) => r.id !== id),
      );
      toast(`Review ${status}`);
    } catch {
      toast('Failed to update review', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Reviews</h1>
        <p className="text-sm text-muted mt-1">Moderate customer product reviews</p>
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
        ) : reviews.length === 0 ? (
          <div className="p-6 text-sm text-muted">No reviews to moderate.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Product ID</th>
                <th className="px-4 py-3 text-left">Reviewer</th>
                <th className="px-4 py-3 text-left">Rating</th>
                <th className="px-4 py-3 text-left">Review</th>
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reviews.map((review) => {
                const badge = STATUS_BADGE[review.status];
                const isUpdating = updatingId === review.id;
                return (
                  <tr key={review.id} className="hover:bg-hover-bg transition-colors">
                    <td className="px-6 py-4 text-muted font-mono text-xs">{review.product_id}</td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-primary">{review.name}</p>
                      <p className="text-xs text-muted">{review.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-accent">{'★'.repeat(review.rating)}</span>
                      <span className="text-muted">{'★'.repeat(5 - review.rating)}</span>
                    </td>
                    <td className="px-4 py-4 max-w-xs">
                      {review.body ? (
                        <p className="text-muted truncate" title={review.body}>{review.body}</p>
                      ) : (
                        <span className="text-muted italic">No body</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-muted whitespace-nowrap">
                      {new Date(review.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={badge.variant} dot>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {review.status !== 'approved' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(review.id, 'approved')}
                          >
                            Approve
                          </Button>
                        )}
                        {review.status !== 'rejected' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(review.id, 'rejected')}
                          >
                            Reject
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
