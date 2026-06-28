import { createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { ProductList } from '@/pages/ProductList';
import { ProductDetail } from '@/pages/ProductDetail';
import { ProductCreate } from '@/pages/ProductCreate';
import { CollectionList } from '@/pages/CollectionList';
import { CollectionDetail } from '@/pages/CollectionDetail';
import { OrderList } from '@/pages/OrderList';
import { OrderDetail } from '@/pages/OrderDetail';
import { CustomerList } from '@/pages/CustomerList';
import { CustomerDetail } from '@/pages/CustomerDetail';
import { Segments } from '@/pages/Segments';
import { DiscountList } from '@/pages/DiscountList';
import { DiscountDetail } from '@/pages/DiscountDetail';
import { SettingsPage } from '@/pages/Settings';
import { Analytics } from '@/pages/Analytics';
import { Email } from '@/pages/Email';
import { Banner } from '@/pages/Banner';
import { Pages } from '@/pages/Pages';
import { BlogList } from '@/pages/BlogList';
import { BlogEditor } from '@/pages/BlogEditor';
import { Reviews } from '@/pages/Reviews';
import { ReportsHub } from '@/pages/reports/ReportsHub';
import { FinanceReports } from '@/pages/reports/FinanceReports';
import { TaxReports } from '@/pages/reports/TaxReports';
import { UserInsights } from '@/pages/UserInsights';
import { SupportTickets } from '@/pages/SupportTickets';
import { SupportTicketDetail } from '@/pages/SupportTicketDetail';
import { Newsletter } from '@/pages/Newsletter';
import { CustomerLeads } from '@/pages/CustomerLeads';
import { AuditLog } from '@/pages/AuditLog';
import { Security } from '@/pages/Security';
import { Ads } from '@/pages/Ads';
import { Invoices } from '@/pages/Invoices';
import { InvoiceEditor } from '@/pages/InvoiceEditor';

export const router = createBrowserRouter([
  {
    path: '/admin/login',
    element: <Login />,
  },
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'analytics', element: <Analytics /> },
      { path: 'products', element: <ProductList /> },
      { path: 'products/new', element: <ProductCreate /> },
      { path: 'products/:slug', element: <ProductDetail /> },
      { path: 'collections', element: <CollectionList /> },
      { path: 'collections/:slug', element: <CollectionDetail /> },
      { path: 'orders', element: <OrderList /> },
      { path: 'orders/:id', element: <OrderDetail /> },
      { path: 'customers', element: <CustomerList /> },
      { path: 'customers/segments', element: <Segments /> },
      { path: 'customers/:id', element: <CustomerDetail /> },
      { path: 'discounts', element: <DiscountList /> },
      { path: 'discounts/new', element: <DiscountDetail /> },
      { path: 'discounts/:id', element: <DiscountDetail /> },
      { path: 'email', element: <Email /> },
      { path: 'banner', element: <Banner /> },
      { path: 'pages', element: <Pages /> },
      { path: 'invoices', element: <Invoices /> },
      { path: 'invoices/new', element: <InvoiceEditor /> },
      { path: 'invoices/:id', element: <InvoiceEditor /> },
      { path: 'blog', element: <BlogList /> },
      { path: 'blog/new', element: <BlogEditor /> },
      { path: 'blog/:slug', element: <BlogEditor /> },
      { path: 'reviews', element: <Reviews /> },
      { path: 'ads', element: <Ads /> },
      { path: 'insights', element: <UserInsights /> },
      { path: 'reports', element: <ReportsHub /> },
      { path: 'reports/finance', element: <FinanceReports /> },
      { path: 'reports/tax', element: <TaxReports /> },
      { path: 'support', element: <SupportTickets /> },
      { path: 'support/:id', element: <SupportTicketDetail /> },
      { path: 'newsletter', element: <Newsletter /> },
      { path: 'customer-leads', element: <CustomerLeads /> },
      { path: 'audit-log', element: <AuditLog /> },
      { path: 'security', element: <Security /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
