import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Check, Clock } from '@/lib/icons';
import { getOrderById, getProductById } from '@/lib/mock-data';
import { formatPrice, formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

const statusVariant: Record<string, 'success' | 'warning' | 'accent' | 'destructive'> = {
  completed: 'success',
  processing: 'accent',
  pending: 'warning',
  refunded: 'destructive',
};

const paymentVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
  paid: 'success',
  pending: 'warning',
  refunded: 'destructive',
};

const PAYMENT_PROCESSING_RATE = 0.029;
const PAYMENT_FIXED_FEE_CENTS = 30;

function TimelineEvent({ label, date, done }: { label: string; date?: string; done: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-green-100' : 'bg-kbd-bg'}`}>
          {done ? <Check size={12} className="text-green-600" /> : <Clock size={12} className="text-muted-foreground" />}
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="pb-4">
        <p className={`text-sm font-medium ${done ? 'text-primary' : 'text-muted'}`}>{label}</p>
        {date && <p className="text-xs text-muted">{formatDate(date)}</p>}
      </div>
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const order = getOrderById(id || '');
  const [notes, setNotes] = useState<string>(() => {
    try { return localStorage.getItem(`sendburmese:notes:order:${id}`) || ''; } catch { return ''; }
  });

  if (!order) {
    return (
      <div>
        <Link to="/admin/orders" className="flex items-center gap-2 text-sm text-muted hover:text-primary mb-6">
          <ArrowLeft size={16} />
          Back to Orders
        </Link>
        <Card>
          <p className="text-center text-muted py-8">Order not found</p>
        </Card>
      </div>
    );
  }

  const subtotal = order.items.reduce((s, it) => s + it.price, 0);
  const totalCost = order.items.reduce((s, it) => s + it.cost, 0);
  const discount = order.discountAmount || 0;
  const tax = order.taxAmount || 0;
  const processingFee = order.paymentStatus === 'paid'
    ? Math.round(order.total * PAYMENT_PROCESSING_RATE + PAYMENT_FIXED_FEE_CENTS)
    : 0;

  const handleMarkCompleted = () => {
    toast(`Order ${order.orderNumber} marked as completed`, 'success');
  };

  const handleRefund = () => {
    toast(`Refund initiated for order ${order.orderNumber}`, 'success');
  };

  const saveNotes = () => {
    try { localStorage.setItem(`sendburmese:notes:order:${id}`, notes); } catch {}
  };

  const isCompleted = order.status === 'completed';
  const isRefunded = order.status === 'refunded';
  const isPaid = order.paymentStatus === 'paid';

  return (
    <div>
      <Link to="/admin/orders" className="flex items-center gap-2 text-sm text-muted hover:text-primary mb-6">
        <ArrowLeft size={16} />
        Back to Orders
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary">Order {order.orderNumber}</h1>
            <Badge variant={statusVariant[order.status]}>
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
            <Badge variant={paymentVariant[order.paymentStatus]}>
              {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-muted mt-1">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isCompleted && !isRefunded && (
            <Button size="sm" onClick={handleMarkCompleted}>Mark Completed</Button>
          )}
          {!isRefunded && isPaid && (
            <Button variant="destructive" size="sm" onClick={handleRefund}>Issue Refund</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card padding={false}>
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-primary">Line Items</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-4 text-left text-xs font-medium text-muted uppercase">Product</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Price</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Cost</th>
                  <th className="py-2 px-4 text-right text-xs font-medium text-muted uppercase">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((item, i) => {
                  const product = getProductById(item.productId);
                  return (
                    <tr key={i}>
                      <td className="py-2.5 px-4 text-sm">
                        <div className="flex items-center gap-3">
                          {product?.images?.[0] && (
                            <img src={product.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                          )}
                          <span className="font-medium">{item.productName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-right">{formatPrice(item.price)}</td>
                      <td className="py-2.5 px-4 text-sm text-right text-muted">{formatPrice(item.cost)}</td>
                      <td className="py-2.5 px-4 text-sm text-right font-medium">{formatPrice(item.price - item.cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card padding={false}>
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-primary">Financial Summary</h2>
            </div>
            <div className="divide-y divide-border">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-muted">Subtotal</span>
                <span className="text-sm">{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-sm text-muted">Discount ({order.discountCode})</span>
                  <span className="text-sm text-green-600">-{formatPrice(discount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-sm text-muted">Tax</span>
                  <span className="text-sm">{formatPrice(tax)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2.5 bg-hover-bg">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-sm font-semibold">{formatPrice(order.total)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-sm text-muted">Cost of Goods</span>
                <span className="text-sm text-muted">-{formatPrice(totalCost)}</span>
              </div>
              {processingFee > 0 && (
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-sm text-muted">Processing Fee (2.9% + $0.30)</span>
                  <span className="text-sm text-muted">-{formatPrice(processingFee)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2.5 bg-hover-bg">
                <span className="text-sm font-semibold">Net Profit</span>
                <span className="text-sm font-semibold">
                  {formatPrice(order.total - totalCost - processingFee)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-primary mb-3">Customer</h2>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-xs font-medium text-accent">
                {order.customerName.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <p className="text-sm font-medium">{order.customerName}</p>
                <p className="text-xs text-muted">{order.customerEmail}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-primary mb-3">Timeline</h2>
            <div>
              <TimelineEvent label="Order created" date={order.createdAt} done />
              <TimelineEvent
                label="Payment received"
                date={isPaid || isRefunded ? order.createdAt : undefined}
                done={isPaid || isRefunded}
              />
              <TimelineEvent
                label={isRefunded ? 'Refunded' : 'Completed'}
                date={isCompleted || isRefunded ? order.createdAt : undefined}
                done={isCompleted || isRefunded}
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-primary mb-3">Order Details</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-xs text-muted">Order ID</dt>
                <dd className="text-xs font-mono text-primary">{order.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-muted">Date</dt>
                <dd className="text-xs text-primary">{formatDate(order.createdAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-muted">Items</dt>
                <dd className="text-xs text-primary">{order.items.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-muted">Payment Method</dt>
                <dd className="text-xs text-primary">Stripe</dd>
              </div>
              {order.discountCode && (
                <div className="flex justify-between">
                  <dt className="text-xs text-muted">Discount Code</dt>
                  <dd className="text-xs font-mono text-accent">{order.discountCode}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-primary mb-3">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Add internal notes about this order..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 resize-y min-h-[80px]"
              rows={3}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
