export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  price: number;
  cost: number;
  compareAtPrice?: number;
  images: string[];
  category: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  featured: boolean;
  createdAt: string;
  fileType: string;
  fileSize: string;
  status: 'active' | 'draft' | 'archived';
  seoTitle?: string;
  seoDescription?: string;
};

export type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  productIds: string[];
  featured: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: { productId: string; productName: string; price: number; cost: number }[];
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'refunded';
  paymentStatus: 'paid' | 'pending' | 'refunded';
  createdAt: string;
  discountCode?: string;
  discountAmount?: number;
  taxAmount?: number;
};

export type Customer = {
  id: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  lastOrderAt: string;
  status: 'active' | 'inactive' | 'churned';
};

const products: Product[] = [
  {
    id: '1',
    slug: 'minimal-dashboard-ui-kit',
    name: 'Minimal Dashboard UI Kit',
    description: 'A clean, modern dashboard UI kit with 60+ components for SaaS products.',
    longDescription: 'Build stunning admin dashboards with this comprehensive UI kit. Includes charts, tables, forms, navigation patterns, and more. Fully customizable in Figma with auto-layout and variants.',
    price: 4900,
    cost: 980,
    compareAtPrice: 6900,
    images: ['https://picsum.photos/seed/dashboard-1/600/400', 'https://picsum.photos/seed/dashboard-2/600/400'],
    category: 'UI Kits',
    tags: ['figma', 'dashboard', 'saas', 'ui-kit'],
    rating: 4.8,
    reviewCount: 124,
    featured: true,
    createdAt: '2026-01-15',
    fileType: 'Figma',
    fileSize: '24 MB',
    status: 'active',
  },
  {
    id: '2',
    slug: 'developer-icon-pack',
    name: 'Developer Icon Pack',
    description: '500+ pixel-perfect icons for developer tools and tech products.',
    longDescription: 'A massive collection of developer-focused icons covering code editors, terminal, git, APIs, databases, cloud services, and more. Available in SVG, PNG, and icon font formats.',
    price: 2900,
    cost: 435,
    images: ['https://picsum.photos/seed/icons-1/600/400', 'https://picsum.photos/seed/icons-2/600/400'],
    category: 'Icons',
    tags: ['icons', 'svg', 'developer', 'tech'],
    rating: 4.9,
    reviewCount: 89,
    featured: true,
    createdAt: '2026-01-20',
    fileType: 'SVG + PNG',
    fileSize: '12 MB',
    status: 'active',
  },
  {
    id: '3',
    slug: 'geometric-sans-font',
    name: 'Geometric Sans Pro',
    description: 'A modern geometric sans-serif typeface with 12 weights.',
    longDescription: 'Geometric Sans Pro is a versatile typeface perfect for headlines, body text, and UI. Includes regular, italic, and variable font files with OpenType features.',
    price: 3900,
    cost: 780,
    compareAtPrice: 5900,
    images: ['https://picsum.photos/seed/font-1/600/400', 'https://picsum.photos/seed/font-2/600/400'],
    category: 'Fonts',
    tags: ['font', 'sans-serif', 'geometric', 'typography'],
    rating: 4.7,
    reviewCount: 56,
    featured: false,
    createdAt: '2026-01-10',
    fileType: 'OTF + TTF + WOFF2',
    fileSize: '8 MB',
    status: 'active',
  },
  {
    id: '4',
    slug: 'startup-landing-templates',
    name: 'Startup Landing Page Templates',
    description: '10 high-converting landing page templates for startups and SaaS.',
    longDescription: 'Launch faster with these battle-tested landing page designs. Each template includes desktop and mobile layouts, component library, and style guide. Built with conversion best practices.',
    price: 5900,
    cost: 1180,
    images: ['https://picsum.photos/seed/landing-1/600/400', 'https://picsum.photos/seed/landing-2/600/400'],
    category: 'Templates',
    tags: ['template', 'landing-page', 'startup', 'saas'],
    rating: 4.6,
    reviewCount: 201,
    featured: true,
    createdAt: '2026-02-01',
    fileType: 'Figma + HTML',
    fileSize: '45 MB',
    status: 'active',
  },
  {
    id: '5',
    slug: 'hand-drawn-illustrations',
    name: 'Hand-Drawn Illustration Pack',
    description: '200+ hand-drawn illustrations for websites, apps, and presentations.',
    longDescription: 'Add personality to your projects with these charming hand-drawn illustrations. Covers business, technology, education, and lifestyle themes. Fully editable in Illustrator and Figma.',
    price: 3400,
    cost: 680,
    images: ['https://picsum.photos/seed/illust-1/600/400', 'https://picsum.photos/seed/illust-2/600/400'],
    category: 'Illustrations',
    tags: ['illustrations', 'hand-drawn', 'vector', 'creative'],
    rating: 4.5,
    reviewCount: 67,
    featured: false,
    createdAt: '2026-02-05',
    fileType: 'AI + SVG + PNG',
    fileSize: '156 MB',
    status: 'active',
  },
  {
    id: '6',
    slug: 'social-media-template-kit',
    name: 'Social Media Template Kit',
    description: '150+ templates for Instagram, Twitter, LinkedIn, and TikTok.',
    longDescription: 'Elevate your social media presence with professional templates. Includes stories, posts, carousels, and cover images. Easy to customize with your brand colors and fonts in Canva or Figma.',
    price: 2400,
    cost: 480,
    compareAtPrice: 3900,
    images: ['https://picsum.photos/seed/social-1/600/400', 'https://picsum.photos/seed/social-2/600/400'],
    category: 'Marketing',
    tags: ['social-media', 'instagram', 'marketing', 'templates'],
    rating: 4.4,
    reviewCount: 312,
    featured: true,
    createdAt: '2026-02-10',
    fileType: 'Figma + Canva',
    fileSize: '89 MB',
    status: 'active',
  },
  {
    id: '7',
    slug: 'react-component-library',
    name: 'React Component Library',
    description: 'Production-ready React components with TypeScript and Tailwind CSS.',
    longDescription: '50+ accessible, performant React components built with TypeScript and styled with Tailwind CSS. Includes forms, data display, navigation, overlays, and more. Full Storybook documentation.',
    price: 7900,
    cost: 1185,
    images: ['https://picsum.photos/seed/react-1/600/400', 'https://picsum.photos/seed/react-2/600/400'],
    category: 'Templates',
    tags: ['react', 'typescript', 'tailwind', 'components'],
    rating: 4.9,
    reviewCount: 178,
    featured: true,
    createdAt: '2026-02-15',
    fileType: 'TSX + CSS',
    fileSize: '3.2 MB',
    status: 'active',
  },
  {
    id: '8',
    slug: 'ecommerce-ui-kit',
    name: 'E-Commerce UI Kit Pro',
    description: 'Complete e-commerce design system with 80+ screens and 200+ components.',
    longDescription: 'Everything you need to design a modern online store. Product pages, cart, checkout, account management, admin dashboard, and email templates. Includes dark mode variants.',
    price: 6900,
    cost: 1035,
    compareAtPrice: 9900,
    images: ['https://picsum.photos/seed/ecom-1/600/400', 'https://picsum.photos/seed/ecom-2/600/400'],
    category: 'UI Kits',
    tags: ['ecommerce', 'figma', 'ui-kit', 'design-system'],
    rating: 4.7,
    reviewCount: 93,
    featured: false,
    createdAt: '2026-02-20',
    fileType: 'Figma',
    fileSize: '67 MB',
    status: 'active',
  },
  {
    id: '9',
    slug: 'monospace-code-font',
    name: 'CodeFlow Mono',
    description: 'A programmer-friendly monospace font with ligatures and powerline glyphs.',
    longDescription: 'Designed specifically for coding. Features programming ligatures, clear distinction between similar characters (0/O, 1/l/I), powerline symbols, and Nerd Font compatibility. 6 weights.',
    price: 1900,
    cost: 380,
    images: ['https://picsum.photos/seed/mono-1/600/400', 'https://picsum.photos/seed/mono-2/600/400'],
    category: 'Fonts',
    tags: ['font', 'monospace', 'coding', 'ligatures'],
    rating: 4.8,
    reviewCount: 245,
    featured: false,
    createdAt: '2026-01-25',
    fileType: 'OTF + TTF + WOFF2',
    fileSize: '4.5 MB',
    status: 'draft',
  },
  {
    id: '10',
    slug: 'brand-identity-mockups',
    name: 'Brand Identity Mockup Bundle',
    description: '50+ photorealistic mockups for brand identity presentations.',
    longDescription: 'Present your brand designs professionally with this comprehensive mockup collection. Includes business cards, letterheads, envelopes, packaging, signage, and digital devices. Smart object layers for easy customization.',
    price: 4400,
    cost: 880,
    images: ['https://picsum.photos/seed/mockup-1/600/400', 'https://picsum.photos/seed/mockup-2/600/400'],
    category: 'Marketing',
    tags: ['mockups', 'branding', 'psd', 'presentation'],
    rating: 4.6,
    reviewCount: 71,
    featured: false,
    createdAt: '2026-02-25',
    fileType: 'PSD + Figma',
    fileSize: '234 MB',
    status: 'active',
  },
  {
    id: '11',
    slug: 'animated-icon-set',
    name: 'Animated Icon Set',
    description: '300+ animated icons in Lottie and GIF format for web and mobile.',
    longDescription: 'Bring your interfaces to life with smooth, lightweight animations. Each icon comes in Lottie JSON, GIF, and After Effects formats. Customizable colors and timing. Perfect for empty states, loading indicators, and micro-interactions.',
    price: 4900,
    cost: 735,
    images: ['https://picsum.photos/seed/anim-1/600/400', 'https://picsum.photos/seed/anim-2/600/400'],
    category: 'Icons',
    tags: ['icons', 'animated', 'lottie', 'motion'],
    rating: 4.7,
    reviewCount: 134,
    featured: true,
    createdAt: '2026-03-01',
    fileType: 'Lottie + GIF + AE',
    fileSize: '78 MB',
    status: 'active',
  },
  {
    id: '12',
    slug: 'nextjs-saas-starter',
    name: 'Next.js SaaS Starter Kit',
    description: 'Full-stack Next.js starter with auth, billing, teams, and admin dashboard.',
    longDescription: 'Skip weeks of boilerplate. This production-ready starter includes authentication (NextAuth), Stripe billing, team management, admin dashboard, email templates, and comprehensive API. Built with Next.js 15, TypeScript, Tailwind CSS, and Prisma.',
    price: 9900,
    cost: 1485,
    images: ['https://picsum.photos/seed/nextjs-1/600/400', 'https://picsum.photos/seed/nextjs-2/600/400'],
    category: 'Templates',
    tags: ['nextjs', 'saas', 'starter', 'fullstack'],
    rating: 4.9,
    reviewCount: 67,
    featured: true,
    createdAt: '2026-03-02',
    fileType: 'TypeScript',
    fileSize: '15 MB',
    status: 'active',
  },
];

const collections: Collection[] = [
  {
    id: 'c1',
    slug: 'ui-kits-templates',
    name: 'UI Kits & Templates',
    description: 'Professional design systems and templates to accelerate your workflow.',
    image: 'https://picsum.photos/seed/col-ui/600/400',
    productIds: ['1', '4', '7', '8', '12'],
    featured: true,
  },
  {
    id: 'c2',
    slug: 'icons-illustrations',
    name: 'Icons & Illustrations',
    description: 'Pixel-perfect icons and hand-crafted illustrations for any project.',
    image: 'https://picsum.photos/seed/col-icons/600/400',
    productIds: ['2', '5', '11'],
    featured: true,
  },
  {
    id: 'c3',
    slug: 'fonts-typography',
    name: 'Fonts & Typography',
    description: 'Beautiful typefaces designed for digital products and print.',
    image: 'https://picsum.photos/seed/col-fonts/600/400',
    productIds: ['3', '9'],
    featured: false,
  },
  {
    id: 'c4',
    slug: 'marketing-social',
    name: 'Marketing & Social',
    description: 'Templates and assets to elevate your marketing and social media.',
    image: 'https://picsum.photos/seed/col-marketing/600/400',
    productIds: ['6', '10'],
    featured: true,
  },
  {
    id: 'c5',
    slug: 'developer-tools',
    name: 'Developer Tools',
    description: 'Code-ready components, fonts, and starter kits for developers.',
    image: 'https://picsum.photos/seed/col-dev/600/400',
    productIds: ['2', '7', '9', '12'],
    featured: false,
  },
];

const orders: Order[] = [
  {
    id: 'ord-1',
    orderNumber: '#1001',
    customerName: 'Sarah Chen',
    customerEmail: 'sarah.chen@example.com',
    items: [{ productId: '1', productName: 'Minimal Dashboard UI Kit', price: 4900, cost: 980 }],
    total: 5292,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: '2026-03-02T14:30:00Z',
    taxAmount: 392,
  },
  {
    id: 'ord-2',
    orderNumber: '#1002',
    customerName: 'James Wilson',
    customerEmail: 'james.w@example.com',
    items: [
      { productId: '7', productName: 'React Component Library', price: 7900, cost: 1185 },
      { productId: '12', productName: 'Next.js SaaS Starter Kit', price: 9900, cost: 1485 },
    ],
    total: 19224,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: '2026-03-02T11:15:00Z',
    taxAmount: 1424,
  },
  {
    id: 'ord-3',
    orderNumber: '#1003',
    customerName: 'Maria Garcia',
    customerEmail: 'maria.g@example.com',
    items: [{ productId: '6', productName: 'Social Media Template Kit', price: 2400, cost: 480 }],
    total: 2592,
    status: 'processing',
    paymentStatus: 'paid',
    createdAt: '2026-03-02T09:45:00Z',
    taxAmount: 192,
  },
  {
    id: 'ord-4',
    orderNumber: '#1004',
    customerName: 'Alex Thompson',
    customerEmail: 'alex.t@example.com',
    items: [{ productId: '3', productName: 'Geometric Sans Pro', price: 3900, cost: 780 }],
    total: 4212,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: '2026-03-01T16:20:00Z',
    taxAmount: 312,
  },
  {
    id: 'ord-5',
    orderNumber: '#1005',
    customerName: 'Emily Davis',
    customerEmail: 'emily.d@example.com',
    items: [
      { productId: '2', productName: 'Developer Icon Pack', price: 2900, cost: 435 },
      { productId: '9', productName: 'CodeFlow Mono', price: 1900, cost: 380 },
    ],
    total: 5184,
    status: 'pending',
    paymentStatus: 'pending',
    createdAt: '2026-03-01T12:00:00Z',
    taxAmount: 384,
  },
  {
    id: 'ord-6',
    orderNumber: '#1006',
    customerName: 'David Kim',
    customerEmail: 'david.k@example.com',
    items: [{ productId: '8', productName: 'E-Commerce UI Kit Pro', price: 6900, cost: 1035 }],
    total: 7452,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: '2026-02-28T10:30:00Z',
    taxAmount: 552,
  },
  {
    id: 'ord-7',
    orderNumber: '#1007',
    customerName: 'Lisa Park',
    customerEmail: 'lisa.p@example.com',
    items: [{ productId: '4', productName: 'Startup Landing Page Templates', price: 5900, cost: 1180 }],
    total: 6372,
    status: 'refunded',
    paymentStatus: 'refunded',
    createdAt: '2026-02-27T15:45:00Z',
    taxAmount: 472,
  },
  {
    id: 'ord-8',
    orderNumber: '#1008',
    customerName: 'Michael Brown',
    customerEmail: 'michael.b@example.com',
    items: [{ productId: '11', productName: 'Animated Icon Set', price: 4900, cost: 735 }],
    total: 5292,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: '2026-02-26T08:15:00Z',
    taxAmount: 392,
  },
  {
    id: 'ord-9',
    orderNumber: '#1009',
    customerName: 'Rachel Green',
    customerEmail: 'rachel.g@example.com',
    items: [
      { productId: '5', productName: 'Hand-Drawn Illustration Pack', price: 3400, cost: 680 },
      { productId: '6', productName: 'Social Media Template Kit', price: 2400, cost: 480 },
    ],
    total: 6264,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: '2026-02-25T13:00:00Z',
    taxAmount: 464,
  },
  {
    id: 'ord-10',
    orderNumber: '#1010',
    customerName: 'Chris Anderson',
    customerEmail: 'chris.a@example.com',
    items: [{ productId: '12', productName: 'Next.js SaaS Starter Kit', price: 9900, cost: 1485 }],
    total: 10692,
    status: 'processing',
    paymentStatus: 'paid',
    createdAt: '2026-02-24T17:30:00Z',
    taxAmount: 792,
  },
  {
    id: 'ord-11',
    orderNumber: '#1011',
    customerName: 'Sarah Chen',
    customerEmail: 'sarah.chen@example.com',
    items: [{ productId: '10', productName: 'Brand Identity Mockup Bundle', price: 4400, cost: 880 }],
    total: 4752,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: '2026-02-23T11:45:00Z',
    taxAmount: 352,
  },
  {
    id: 'ord-12',
    orderNumber: '#1012',
    customerName: 'Tom Martinez',
    customerEmail: 'tom.m@example.com',
    items: [{ productId: '1', productName: 'Minimal Dashboard UI Kit', price: 4900, cost: 980 }],
    total: 5292,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: '2026-02-22T09:00:00Z',
    taxAmount: 392,
  },
  {
    id: 'ord-13',
    orderNumber: '#1013',
    customerName: 'Nina Patel',
    customerEmail: 'nina.p@example.com',
    items: [
      { productId: '7', productName: 'React Component Library', price: 7900, cost: 1185 },
      { productId: '2', productName: 'Developer Icon Pack', price: 2900, cost: 435 },
    ],
    total: 11664,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: '2026-02-21T14:15:00Z',
    taxAmount: 864,
  },
  {
    id: 'ord-14',
    orderNumber: '#1014',
    customerName: 'James Wilson',
    customerEmail: 'james.w@example.com',
    items: [{ productId: '4', productName: 'Startup Landing Page Templates', price: 5900, cost: 1180 }],
    total: 6372,
    status: 'pending',
    paymentStatus: 'pending',
    createdAt: '2026-02-20T16:00:00Z',
    taxAmount: 472,
  },
  {
    id: 'ord-15',
    orderNumber: '#1015',
    customerName: 'Olivia Zhang',
    customerEmail: 'olivia.z@example.com',
    items: [{ productId: '8', productName: 'E-Commerce UI Kit Pro', price: 6900, cost: 1035 }],
    total: 7452,
    status: 'completed',
    paymentStatus: 'paid',
    createdAt: '2026-02-19T10:30:00Z',
    taxAmount: 552,
  },
];

const customers: Customer[] = [
  {
    id: 'cust-1',
    email: 'sarah.chen@example.com',
    totalOrders: 2,
    totalSpent: 9300,
    createdAt: '2025-11-15',
    lastOrderAt: '2026-03-02',
    status: 'active',
  },
  {
    id: 'cust-2',
    email: 'james.w@example.com',
    totalOrders: 2,
    totalSpent: 23700,
    createdAt: '2025-12-01',
    lastOrderAt: '2026-03-02',
    status: 'active',
  },
  {
    id: 'cust-3',
    email: 'maria.g@example.com',
    totalOrders: 1,
    totalSpent: 2400,
    createdAt: '2026-01-10',
    lastOrderAt: '2026-03-02',
    status: 'active',
  },
  {
    id: 'cust-4',
    email: 'alex.t@example.com',
    totalOrders: 1,
    totalSpent: 3900,
    createdAt: '2026-01-20',
    lastOrderAt: '2026-03-01',
    status: 'active',
  },
  {
    id: 'cust-5',
    email: 'emily.d@example.com',
    totalOrders: 1,
    totalSpent: 4800,
    createdAt: '2026-02-01',
    lastOrderAt: '2026-03-01',
    status: 'active',
  },
  {
    id: 'cust-6',
    email: 'david.k@example.com',
    totalOrders: 1,
    totalSpent: 6900,
    createdAt: '2026-01-05',
    lastOrderAt: '2026-02-28',
    status: 'active',
  },
  {
    id: 'cust-7',
    email: 'lisa.p@example.com',
    totalOrders: 1,
    totalSpent: 0,
    createdAt: '2026-02-10',
    lastOrderAt: '2026-02-27',
    status: 'churned',
  },
  {
    id: 'cust-8',
    email: 'michael.b@example.com',
    totalOrders: 1,
    totalSpent: 4900,
    createdAt: '2026-02-15',
    lastOrderAt: '2026-02-26',
    status: 'active',
  },
  {
    id: 'cust-9',
    email: 'rachel.g@example.com',
    totalOrders: 1,
    totalSpent: 5800,
    createdAt: '2025-12-20',
    lastOrderAt: '2026-02-25',
    status: 'active',
  },
  {
    id: 'cust-10',
    email: 'chris.a@example.com',
    totalOrders: 1,
    totalSpent: 9900,
    createdAt: '2026-02-20',
    lastOrderAt: '2026-02-24',
    status: 'active',
  },
  {
    id: 'cust-11',
    email: 'tom.m@example.com',
    totalOrders: 1,
    totalSpent: 4900,
    createdAt: '2026-01-15',
    lastOrderAt: '2026-02-22',
    status: 'inactive',
  },
  {
    id: 'cust-12',
    email: 'nina.p@example.com',
    totalOrders: 1,
    totalSpent: 10800,
    createdAt: '2026-02-05',
    lastOrderAt: '2026-02-21',
    status: 'inactive',
  },
];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const extraCustomerNames = [
  'Jordan Lee', 'Taylor Swift', 'Morgan Reed', 'Casey Brooks', 'Drew Palmer',
  'Riley Morgan', 'Avery Quinn', 'Parker Hayes', 'Quinn Foster', 'Sage Mitchell',
  'Cameron White', 'Dakota Stone', 'Emerson Clarke', 'Finley Scott', 'Harper Young',
  'Jamie Cruz', 'Kendall Price', 'Logan Blake', 'Mackenzie Ray', 'Noel Gray',
  'Peyton Frost', 'Reagan Cole', 'Skyler Dean', 'Tatum Marsh', 'Val Ortiz',
  'Winter Hale', 'Addison Bell', 'Blake Torres', 'Corey Lane', 'Devon Kirk',
];

const DISCOUNT_CODES = ['SAVE10', 'WELCOME15', 'BUNDLE20', 'FLASH25', 'HOLIDAY30'];
const DISCOUNT_PERCENTS: Record<string, number> = {
  SAVE10: 0.10, WELCOME15: 0.15, BUNDLE20: 0.20, FLASH25: 0.25, HOLIDAY30: 0.30,
};
const DEFAULT_TAX_RATE = 0.08;

function generateHistoricalOrders(): Order[] {
  const rng = mulberry32(42);
  const allProducts = products.filter((p) => p.status === 'active');
  const featuredIds = new Set(allProducts.filter((p) => p.featured).map((p) => p.id));
  const existingEmails = customers.map((c) => c.email.split('@')[0].replace(/\./g, ' '));
  const allNames = [...existingEmails.map((e) => e.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')), ...extraCustomerNames];
  const generated: Order[] = [];

  const startDate = new Date('2025-03-01T00:00:00Z');
  const endDate = new Date('2026-02-18T23:59:59Z');
  let orderNum = 1;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const month = d.getMonth();
    const year = d.getFullYear();

    let seasonMultiplier = 1.0;
    if (year === 2025) {
      if (month >= 3 && month <= 5) seasonMultiplier = 1.0;
      else if (month >= 6 && month <= 8) seasonMultiplier = 1.1;
      else if (month === 9) seasonMultiplier = 1.2;
      else if (month === 10) seasonMultiplier = 1.5;
      else if (month === 11) seasonMultiplier = 1.8;
    } else {
      if (month === 0) seasonMultiplier = 0.85;
      else if (month === 1) seasonMultiplier = 0.95;
    }

    const monthsSinceStart = (year - 2025) * 12 + month - 2;
    const growthMultiplier = Math.pow(1.005, monthsSinceStart);
    const baseOrders = 3 + Math.floor(rng() * 6);
    const dayOrders = Math.max(1, Math.round(baseOrders * seasonMultiplier * growthMultiplier));

    for (let i = 0; i < dayOrders; i++) {
      const hour = Math.floor(rng() * 14) + 8;
      const minute = Math.floor(rng() * 60);
      const orderDate = new Date(d);
      orderDate.setUTCHours(hour, minute, 0, 0);

      const numItems = rng() < 0.65 ? 1 : rng() < 0.8 ? 2 : 3;
      const chosenProducts: Product[] = [];
      for (let j = 0; j < numItems; j++) {
        const pool = allProducts.filter((p) => !chosenProducts.includes(p));
        const weighted = pool.flatMap((p) => (featuredIds.has(p.id) ? [p, p] : [p]));
        chosenProducts.push(weighted[Math.floor(rng() * weighted.length)]);
      }

      const items = chosenProducts.map((p) => ({
        productId: p.id,
        productName: p.name,
        price: p.price,
        cost: p.cost,
      }));
      const subtotal = items.reduce((s, it) => s + it.price, 0);

      let discountCode: string | undefined;
      let discountAmount = 0;
      if (rng() < 0.12) {
        discountCode = DISCOUNT_CODES[Math.floor(rng() * DISCOUNT_CODES.length)];
        discountAmount = Math.round(subtotal * DISCOUNT_PERCENTS[discountCode]);
      }

      const afterDiscount = subtotal - discountAmount;
      const taxAmount = Math.round(afterDiscount * DEFAULT_TAX_RATE);
      const total = afterDiscount + taxAmount;

      const statusRoll = rng();
      let status: Order['status'];
      let paymentStatus: Order['paymentStatus'];
      if (statusRoll < 0.80) { status = 'completed'; paymentStatus = 'paid'; }
      else if (statusRoll < 0.88) { status = 'processing'; paymentStatus = 'paid'; }
      else if (statusRoll < 0.93) { status = 'pending'; paymentStatus = 'pending'; }
      else { status = 'refunded'; paymentStatus = 'refunded'; }

      const nameIdx = Math.floor(rng() * allNames.length);
      const name = allNames[nameIdx];
      const email = name.toLowerCase().replace(/\s+/g, '.') + '@example.com';

      generated.push({
        id: `gen-${orderNum}`,
        orderNumber: `#${String(orderNum).padStart(4, '0')}`,
        customerName: name,
        customerEmail: email,
        items,
        total,
        status,
        paymentStatus,
        createdAt: orderDate.toISOString(),
        discountCode,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        taxAmount,
      });
      orderNum++;
    }
  }

  return generated;
}

let _allOrders: Order[] | null = null;
function getAllOrders(): Order[] {
  if (!_allOrders) {
    const historical = generateHistoricalOrders();
    _allOrders = [...historical, ...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  return _allOrders;
}

export function getProducts(): Product[] {
  return products;
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getCategories(): string[] {
  return [...new Set(products.map((p) => p.category))];
}

export function getCollections(): Collection[] {
  return collections;
}

export function getCollectionBySlug(slug: string): Collection | undefined {
  return collections.find((c) => c.slug === slug);
}

export function getCollectionProducts(collectionId: string): Product[] {
  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) return [];
  return products.filter((p) => collection.productIds.includes(p.id));
}

export function getOrders(): Order[] {
  return getAllOrders();
}

export function getOrderById(id: string): Order | undefined {
  return getAllOrders().find((o) => o.id === id);
}

export function getCustomers(): Customer[] {
  return customers;
}

export function getCustomerById(id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}

export type Discount = {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  minOrderAmount?: number;
  maxUses?: number;
  currentUses: number;
  startsAt: string;
  endsAt?: string;
  active: boolean;
  createdAt: string;
};

const discounts: Discount[] = [
  {
    id: 'disc-1',
    code: 'WELCOME15',
    type: 'percentage',
    value: 15,
    maxUses: 500,
    currentUses: 127,
    startsAt: '2026-01-01',
    active: true,
    createdAt: '2025-12-20',
  },
  {
    id: 'disc-2',
    code: 'SAVE10',
    type: 'percentage',
    value: 10,
    currentUses: 342,
    startsAt: '2025-06-01',
    active: true,
    createdAt: '2025-05-28',
  },
  {
    id: 'disc-3',
    code: 'BUNDLE20',
    type: 'percentage',
    value: 20,
    minOrderAmount: 5000,
    maxUses: 200,
    currentUses: 89,
    startsAt: '2026-02-01',
    endsAt: '2026-03-31',
    active: true,
    createdAt: '2026-01-28',
  },
  {
    id: 'disc-4',
    code: 'FLAT5',
    type: 'fixed_amount',
    value: 500,
    currentUses: 56,
    startsAt: '2026-01-15',
    endsAt: '2026-02-15',
    active: false,
    createdAt: '2026-01-10',
  },
  {
    id: 'disc-5',
    code: 'FLASH25',
    type: 'percentage',
    value: 25,
    maxUses: 100,
    currentUses: 100,
    startsAt: '2026-02-14',
    endsAt: '2026-02-14',
    active: false,
    createdAt: '2026-02-10',
  },
  {
    id: 'disc-6',
    code: 'SPRING2026',
    type: 'percentage',
    value: 15,
    maxUses: 300,
    currentUses: 0,
    startsAt: '2026-04-01',
    endsAt: '2026-04-30',
    active: true,
    createdAt: '2026-03-01',
  },
  {
    id: 'disc-7',
    code: 'FLAT10OFF',
    type: 'fixed_amount',
    value: 1000,
    minOrderAmount: 3000,
    currentUses: 23,
    startsAt: '2026-02-01',
    active: true,
    createdAt: '2026-01-30',
  },
];

export function getDiscounts(): Discount[] {
  return discounts;
}

export function getDiscountById(id: string): Discount | undefined {
  return discounts.find((d) => d.id === id);
}

export function getDashboardStats() {
  const allOrds = getAllOrders();
  const totalRevenue = allOrds
    .filter((o) => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + o.total, 0);

  return {
    totalProducts: products.length,
    totalRevenue,
    totalOrders: allOrds.length,
    totalCustomers: customers.length,
  };
}
