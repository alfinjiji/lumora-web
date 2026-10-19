export type Role = 'owner' | 'staff'
export type User = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  phone: string
  bio: string
  avatar: string
  invited?: boolean
}
export type Variant = {
  id: string
  product_id?: string
  sku: string
  name: string
  price: number
  stock: number
  active?: number
}
export type Product = {
  id: string
  name: string
  collection: string
  note: string
  description: string
  category: string[]
  image: string
  status: 'Active' | 'Draft'
  price: number
  stock: number
  variants: Variant[]
}
export type Order = {
  id: string
  receipt: string
  amount: number
  currency: string
  items: {
    id: string
    name: string
    variant?: string
    quantity: number
    unitPrice: number
  }[]
  customer: {
    name: string
    email: string
    phone?: string
    address?: string
    city?: string
  }
  status: string
  payment_id?: string
  created_at: string
  channel: string
  fulfilment: string
  tracking: string
  carrier: string
  note: string
  stock_state: string
  manual_reference: string
}
export type Enquiry = {
  id: string
  name: string
  email: string
  phone: string
  subject: string
  channel: string
  message: string
  notes: string
  status: string
  assigned_to: string | null
  created_at: string
}
export type Content = {
  headline: string
  subtitle: string
  announcement: string
  button: string
  image: string
  featured: string
}
export type Movement = {
  id: string
  variant_id: string
  sku: string
  delta: number
  stock_after: number
  reason: string
  created_at: string
}
export type Snapshot = {
  user: User
  products: Product[]
  orders: Order[]
  enquiries: Enquiry[]
  team: User[]
  content: { draft: Content; published: Content; updated_at: string } | null
  movements: Movement[]
  activity: { action: string; detail: string; created_at: string }[]
  timezone: string
}
export type Invitation = {
  subject: string
  to: string
  url: string
  message: string
  sent: false
}
export type Page =
  | 'overview'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'enquiries'
  | 'content'
  | 'team'
  | 'profile'
export const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: n % 100 ? 2 : 0,
  }).format(n / 100)
export const date = (s: string) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z'))
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
