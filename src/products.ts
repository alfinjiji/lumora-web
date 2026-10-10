export type Mood = 'warm' | 'fresh' | 'floral'
export type Product = {
  id: string
  name: string
  category: Mood
  notes: string
  description: string
  price: number
  color: string
  backdrop: string
  label: string
}

// Sample catalog. Replace these entries with confirmed products before launch.
export const products: Product[] = [
  {
    id: 'amber-hour',
    name: 'Amber Hour',
    category: 'warm',
    notes: 'Amber · sandalwood · vanilla',
    description:
      'A soft, golden scent for slowing down. Warm amber meets quiet woods, with a gentle touch of vanilla.',
    price: 899,
    color: '#a36234',
    backdrop: '#241c15',
    label: 'The golden one',
  },
  {
    id: 'quiet-forest',
    name: 'Quiet Forest',
    category: 'fresh',
    notes: 'Cedar · moss · bergamot',
    description:
      'An invitation to step away from the noise. Fresh bergamot opens into deep cedar and the stillness of a forest floor.',
    price: 999,
    color: '#59634a',
    backdrop: '#1b2019',
    label: 'A breath of calm',
  },
  {
    id: 'rosewater',
    name: 'Rosewater',
    category: 'floral',
    notes: 'Rose · peony · soft musk',
    description:
      'Fresh petals, an open window, and a little room to dream. A delicate floral scent with a soft, comforting finish.',
    price: 849,
    color: '#a96f66',
    backdrop: '#291c1d',
    label: 'Something soft',
  },
  {
    id: 'midnight-fig',
    name: 'Midnight Fig',
    category: 'warm',
    notes: 'Fig · black tea · cedar',
    description:
      'For the hours that belong to you. Ripe fig and black tea settle into a warm, woody base.',
    price: 1099,
    color: '#4e424b',
    backdrop: '#211b24',
    label: 'After the sun sets',
  },
]

export const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
