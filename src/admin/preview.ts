import type { Snapshot } from './types'
import { products as catalog } from '../products'
// Used only by the explicitly labelled static design review. Never used by the API.
export function previewSnapshot(): Snapshot {
  const user = {
    id: 'preview',
    name: 'Studio preview',
    email: 'preview@example.com',
    role: 'owner' as const,
    active: true,
    phone: '',
    bio: 'Design review only. No real account.',
    avatar: '',
  }
  const products = catalog.map((p, i) => ({
    id: p.id,
    name: p.name,
    collection: 'The Candle Edit',
    note: p.note,
    description: p.description,
    category: p.category,
    image: p.image,
    status: 'Active' as const,
    price: p.price * 100,
    stock: [8, 34, 5, 22, 0, 17, 12, 20][i],
    variants: [
      {
        id: p.id,
        sku: 'AUR-' + p.id.toUpperCase(),
        name: p.note,
        price: p.price * 100,
        stock: [8, 34, 5, 22, 0, 17, 12, 20][i],
      },
    ],
  }))
  const names = [
    'Ananya Menon',
    'Rahul Nair',
    'Meera Thomas',
    'Arjun George',
    'Diya Joseph',
  ]
  const orders = names.map((name, i) => ({
    id: 'sample-' + i,
    receipt: 'AF-' + (1048 - i),
    amount: products[i].price * (i % 2 ? 1 : 2),
    currency: 'INR',
    items: [
      {
        id: products[i].id,
        name: products[i].name,
        quantity: i % 2 ? 1 : 2,
        unitPrice: products[i].price,
      },
    ],
    customer: {
      name,
      email: 'sample@example.com',
      city: [
        'Kochi, Kerala',
        'Bengaluru, Karnataka',
        'Kannur, Kerala',
        'Chennai, Tamil Nadu',
        'Mumbai, Maharashtra',
      ][i],
    },
    status: i === 1 ? 'created' : 'paid',
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
    channel: ['Website', 'WhatsApp', 'Website', 'Instagram', 'Website'][i],
    fulfilment: [
      'Processing',
      'Awaiting payment',
      'Shipped',
      'Delivered',
      'Processing',
    ][i],
    tracking: i === 2 ? 'SAMPLE-TRACKING' : '',
    carrier: i === 2 ? 'Sample carrier' : '',
    note: 'Illustrative design record.',
    stock_state: 'reserved',
    manual_reference: '',
  }))
  const content = {
    headline: 'A little light. A lasting feeling.',
    subtitle: 'Hand-poured candles for moments that matter.',
    announcement: 'A little care in every detail.',
    button: 'Discover the collection',
    image: '/images/auraflare/hero.webp',
    featured: 'All',
  }
  return {
    user,
    products,
    orders,
    enquiries: [
      {
        id: 'sample-enquiry',
        name: 'Nisha Mathew',
        email: 'sample@example.com',
        phone: '',
        subject: 'Wedding favours · 100 candles',
        channel: 'WhatsApp',
        message:
          'We are planning a wedding and would love to discuss personalised candles.',
        notes: 'Sample conversation. No message will be sent.',
        status: 'New',
        assigned_to: null,
        created_at: new Date().toISOString(),
      },
    ],
    team: [user],
    content: {
      draft: content,
      published: content,
      updated_at: new Date().toISOString(),
    },
    movements: [],
    activity: [],
    timezone: 'Asia/Kolkata',
  }
}
