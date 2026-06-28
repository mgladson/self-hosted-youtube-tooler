import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';

export function SettingsPage() {
  const { toast } = useToast();
  const [store, setStore] = useState({
    name: 'PixelCart',
    url: 'https://pixelcart.com',
    email: 'contact@findcarehelper.com',
  });

  const [payment, setPayment] = useState({
    provider: 'stripe',
    currency: 'usd',
  });

  const [notifications, setNotifications] = useState({
    orderConfirmation: true,
    orderShipped: true,
    lowStock: false,
    newCustomer: true,
  });

  const handleSave = () => {
    toast('Settings saved successfully');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Settings</h1>
          <p className="text-sm text-muted mt-1">Manage your store settings</p>
        </div>
        <Button onClick={handleSave}>Save Changes</Button>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <h2 className="font-semibold text-primary mb-4">Store Information</h2>
          <div className="space-y-4">
            <Input
              label="Store Name"
              value={store.name}
              onChange={(e) => setStore({ ...store, name: e.target.value })}
            />
            <Input
              label="Store URL"
              value={store.url}
              onChange={(e) => setStore({ ...store, url: e.target.value })}
            />
            <Input
              label="Contact Email"
              type="email"
              value={store.email}
              onChange={(e) => setStore({ ...store, email: e.target.value })}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-primary mb-4">Payments</h2>
          <div className="space-y-4">
            <Select
              label="Payment Provider"
              options={[
                { value: 'stripe', label: 'Stripe' },
                { value: 'paypal', label: 'PayPal' },
                { value: 'lemonsqueezy', label: 'Lemon Squeezy' },
              ]}
              value={payment.provider}
              onChange={(e) => setPayment({ ...payment, provider: e.target.value })}
            />
            <Select
              label="Currency"
              options={[
                { value: 'usd', label: 'USD — US Dollar' },
                { value: 'eur', label: 'EUR — Euro' },
                { value: 'gbp', label: 'GBP — British Pound' },
              ]}
              value={payment.currency}
              onChange={(e) => setPayment({ ...payment, currency: e.target.value })}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-primary mb-4">Notifications</h2>
          <div className="space-y-3">
            {[
              { key: 'orderConfirmation' as const, label: 'Order confirmation emails' },
              { key: 'orderShipped' as const, label: 'Order shipped notifications' },
              { key: 'lowStock' as const, label: 'Low stock alerts' },
              { key: 'newCustomer' as const, label: 'New customer notifications' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications[item.key]}
                  onChange={(e) =>
                    setNotifications({ ...notifications, [item.key]: e.target.checked })
                  }
                  className="rounded border-border text-accent focus:ring-accent/30"
                />
                <span className="text-sm text-primary">{item.label}</span>
              </label>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
