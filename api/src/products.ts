type ProductInfo = {
  id: string;
  name: string;
  price: number;
};

const products: ProductInfo[] = [
  { id: '1', name: 'Minimal Dashboard UI Kit', price: 4900 },
  { id: '2', name: 'Handcrafted Icon Pack — 1,200 Icons', price: 2900 },
  { id: '3', name: 'Serif Pro Font Family', price: 3900 },
  { id: '4', name: 'E-Commerce Email Templates', price: 2400 },
  { id: '5', name: 'Notion Startup Toolkit', price: 1900 },
  { id: '6', name: '3D Illustration Pack', price: 5900 },
  { id: '7', name: 'Landing Page Wireframe Kit', price: 3400 },
  { id: '8', name: 'Social Media Templates Bundle', price: 2700 },
  { id: '9', name: 'Portfolio Website Template', price: 4400 },
  { id: '10', name: 'Mobile App UI Kit', price: 6900 },
  { id: '11', name: 'Brand Identity Guidelines Template', price: 3200 },
  { id: '12', name: 'Developer Resume Template Pack', price: 1500 },
];

const productMap = new Map(products.map((p) => [p.id, p]));

export function getProductById(id: string): ProductInfo | undefined {
  return productMap.get(id);
}

export function validateCartItems(
  items: { productId: string; quantity: number }[],
): { valid: ProductInfo[]; total: number } | { error: string } {
  const valid: ProductInfo[] = [];
  let total = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) return { error: `Unknown product: ${item.productId}` };
    if (item.quantity < 1 || item.quantity > 99) return { error: 'Quantity must be between 1 and 99' };
    valid.push(product);
    total += product.price * item.quantity;
  }

  if (valid.length === 0) return { error: 'Cart is empty' };
  return { valid, total };
}
