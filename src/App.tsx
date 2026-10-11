import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Checkout from './components/Checkout'
import { products, formatPrice } from './products'
import type { Product, Mood } from './products'
import './App.css'

type CartItem = { id: string; quantity: number }
type IconName =
  | 'bag'
  | 'arrow'
  | 'close'
  | 'plus'
  | 'minus'
  | 'spark'
  | 'leaf'
  | 'menu'
  | 'check'
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    bag: (
      <>
        <path d="M5 7h14l1 14H4L5 7Z" />
        <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h15M13 6l6 6-6 6" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    spark: (
      <>
        <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 3c-1 10-3 16-10 16-9 0-9-13 10-16Z" />
        <path d="M4 22 16 8" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function readCart(): CartItem[] {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem('lumora-cart-v1') || '[]',
    )
    if (!Array.isArray(saved)) return []
    const unique = new Map<string, CartItem>()
    for (const item of saved) {
      if (
        item &&
        typeof item.id === 'string' &&
        products.some((product) => product.id === item.id) &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 99
      )
        unique.set(item.id, { id: item.id, quantity: item.quantity })
    }
    return [...unique.values()]
  } catch {
    return []
  }
}

function tiltProduct(event: React.PointerEvent<HTMLElement>) {
  if (
    event.pointerType !== 'mouse' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty(
    '--tilt-x',
    `${((event.clientY - rect.top) / rect.height - 0.5) * -5}deg`,
  )
  event.currentTarget.style.setProperty(
    '--tilt-y',
    `${((event.clientX - rect.left) / rect.width - 0.5) * 7}deg`,
  )
}
function resetTilt(event: React.PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty('--tilt-x', '0deg')
  event.currentTarget.style.setProperty('--tilt-y', '0deg')
}

export default function App() {
  const [filter, setFilter] = useState<Mood | 'all'>('all')
  const [cart, setCart] = useState<CartItem[]>(readCart)
  const [cartOpen, setCartOpen] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [checkout, setCheckout] = useState(false)
  const [receipt, setReceipt] = useState('')
  const [faq, setFaq] = useState<number | null>(0)
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const cartDialog = useRef<HTMLDialogElement>(null)
  const productDialog = useRef<HTMLDialogElement>(null)
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cart.reduce(
    (sum, item) =>
      sum +
      products.find((product) => product.id === item.id)!.price * item.quantity,
    0,
  )

  useEffect(() => {
    try {
      localStorage.setItem('lumora-cart-v1', JSON.stringify(cart))
    } catch {
      /* The cart still works when browser storage is unavailable. */
    }
  }, [cart])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (product && !productDialog.current?.open)
      productDialog.current?.showModal()
    if (!product) productDialog.current?.close()
  }, [product])
  useEffect(() => {
    if (cartOpen && !cartDialog.current?.open) cartDialog.current?.showModal()
    if (!cartOpen) cartDialog.current?.close()
  }, [cartOpen])
  useEffect(() => {
    if (!cartOpen && !product) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [cartOpen, product])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const images = [...document.querySelectorAll<HTMLElement>('[data-depth]')]
    let frame = 0
    const measure = () => {
      frame = 0
      for (const element of images) {
        const rect = element.getBoundingClientRect()
        const amount = motion.matches
          ? 0
          : Math.max(
              -1,
              Math.min(
                1,
                (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight,
              ),
            )
        element.style.setProperty('--scroll-y', `${amount * -32}px`)
        element.style.setProperty('--scroll-tilt', `${amount * 2}deg`)
      }
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    motion.addEventListener('change', schedule)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      motion.removeEventListener('change', schedule)
    }
  }, [])

  const addToCart = (id: string) => {
    setReceipt('')
    setCart((items) => {
      const existing = items.find((item) => item.id === id)
      return existing
        ? items.map((item) =>
            item.id === id
              ? { ...item, quantity: Math.min(99, item.quantity + 1) }
              : item,
          )
        : [...items, { id, quantity: 1 }]
    })
    setToast(
      `${products.find((product) => product.id === id)!.name} added to your bag`,
    )
    setCheckout(false)
  }
  const updateQuantity = (id: string, delta: number) => {
    setCart((items) =>
      items
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.min(99, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    )
    setCheckout(false)
  }
  const navigate = () => setMenuOpen(false)
  const subscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEmailSubmitted(true)
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Lumora home">
          lumora<span>✦</span>
        </a>
        <nav
          className={menuOpen ? 'primary-nav is-open' : 'primary-nav'}
          aria-label="Main navigation"
          id="main-navigation"
        >
          <a href="#collection" onClick={navigate}>
            The collection
          </a>
          <a href="#story" onClick={navigate}>
            Our world
          </a>
          <a href="#gifting" onClick={navigate}>
            The art of gifting
          </a>
        </nav>
        <div className="header-actions">
          <button
            className="bag-button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open shopping bag, ${count} items`}
          >
            <Icon name="bag" />
            <span>Bag</span>
            <span className="bag-count">{count}</span>
          </button>
          <button
            className="icon-button mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-controls="main-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </header>
      <main id="main">
        <section className="photo-hero" aria-labelledby="hero-title">
          <div className="hero-image depth-image" data-depth="hero">
            <img
              src="/images/after-dark-story.webp"
              alt="Approved Lumora campaign illustration: an amber ribbed-glass candle glowing on dark stone"
              width="1024"
              height="1024"
              fetchPriority="high"
            />
          </div>
          <div className="hero-shade" />
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> LUMORA / THE AFTER DARK EDIT
            </p>
            <h1 id="hero-title">
              For the hours
              <br />
              that feel <br />
              <em>like yours.</em>
            </h1>
            <p>
              A familiar room. A softer light. Discover fragrances made for the
              moments you want to keep.
            </p>
            <a className="button button-dark" href="#collection">
              Find your candle <Icon name="arrow" />
            </a>
          </div>
          <div className="hero-bottom">
            <a href="#collection">
              EXPLORE THE SCENT EDIT <span>↓</span>
            </a>
            <span>01 / LIGHT, WITH FEELING</span>
          </div>
          <span className="hero-image-note">Approved campaign concept</span>
        </section>
        <div className="brand-strip">
          <span>THOUGHTFUL GIFTS</span>
          <span>✦</span>
          <span>EVERYDAY ESCAPES</span>
          <span>✦</span>
          <span>THE LUMORA WAY</span>
        </div>
        <section
          className="collection section-shell"
          id="collection"
          aria-labelledby="collection-title"
        >
          <div className="section-heading reveal">
            <div>
              <p className="eyebrow">THE SCENT EDIT / 01</p>
              <h2 id="collection-title">
                Find your
                <br />
                <em>signature glow.</em>
              </h2>
            </div>
            <div className="collection-intro">
              <p>
                Four moods. One beautiful ritual.
                <br />
                Discover a scent that feels like you.
              </p>
              <span>Sample collection · INR · licensed mood photography</span>
            </div>
          </div>
          <div className="collection-toolbar reveal">
            <div className="filter-tabs" aria-label="Filter candles by scent">
              {(
                [
                  ['all', 'All candles'],
                  ['warm', 'Warm & woody'],
                  ['fresh', 'Fresh & earthy'],
                  ['floral', 'Soft & floral'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? 'active' : ''}
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="catalog-note">A mood for every room.</span>
          </div>
          <div className="product-grid">
            {products
              .filter((item) => filter === 'all' || item.category === filter)
              .map((item, index) => (
                <article
                  className="product-card tilt-card"
                  key={item.id}
                  onPointerMove={tiltProduct}
                  onPointerLeave={resetTilt}
                  style={
                    { '--product-glow': item.color } as React.CSSProperties
                  }
                >
                  <button
                    className="product-visual"
                    onClick={() => setProduct(item)}
                    aria-label={`View ${item.name} candle details`}
                  >
                    <span className="product-tag">{item.label}</span>
                    <span className="product-number">0{index + 1}</span>
                    <img
                      src={item.image}
                      alt={item.imageAlt}
                      width="750"
                      height="1000"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="product-view">
                      Explore the scent <Icon name="arrow" size={16} />
                    </span>
                  </button>
                  <div className="product-info">
                    <div className="product-title-row">
                      <button
                        className="product-name"
                        onClick={() => setProduct(item)}
                      >
                        {item.name}
                      </button>
                      <span>{formatPrice(item.price)}</span>
                    </div>
                    <p className="product-notes">{item.notes}</p>
                    <button
                      className="product-add"
                      onClick={() => addToCart(item.id)}
                      aria-label={`Add ${item.name} to bag`}
                    >
                      Add to bag <Icon name="plus" size={18} />
                    </button>
                  </div>
                </article>
              ))}
          </div>
        </section>
        <section
          className="story-section section-shell"
          id="story"
          aria-labelledby="story-title"
        >
          <div className="story-photo depth-image" data-depth="story">
            <img
              src="/images/photography/our-world.jpg"
              alt="Candles beside a window, plants, a book, and a cup"
              width="1000"
              height="1200"
              loading="lazy"
              decoding="async"
            />
            <span className="photo-caption">
              A SMALL RITUAL. AN ENTIRELY DIFFERENT FEELING.
            </span>
          </div>
          <div className="story-copy reveal">
            <p className="eyebrow">OUR WORLD / 02</p>
            <h2 id="story-title">
              Beautiful things.
              <br />
              <em>Everyday moments.</em>
            </h2>
            <p>
              Lumora begins with a simple thought: a little light can change the
              way a room feels. We’re a new candle studio, building a collection
              for quiet evenings, thoughtful gifts, and the spaces you call your
              own.
            </p>
            <div className="scent-families">
              <span>
                <i>01</i> Warm & woody
              </span>
              <span>
                <i>02</i> Fresh & earthy
              </span>
              <span>
                <i>03</i> Soft & floral
              </span>
            </div>
            <a className="quiet-link" href="#collection">
              Find your kind of calm <Icon name="arrow" size={18} />
            </a>
          </div>
        </section>
        <section
          className="ritual-section"
          id="ritual"
          aria-labelledby="ritual-title"
        >
          <div className="ritual-photo depth-image" data-depth="ritual">
            <img
              src="/images/photography/evening-ritual.jpg"
              alt="A photographic arrangement of red, amber, and white glass candles"
              width="1600"
              height="1000"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="ritual-shade" />
          <div className="ritual-copy">
            <p className="eyebrow">MAKE ROOM FOR YOURSELF / 03</p>
            <h2 id="ritual-title">
              Less hurry.
              <br />
              <em>More here.</em>
            </h2>
            <p>
              A slow conversation. A favourite song. An evening with nowhere
              else to be.
            </p>
            <a className="quiet-link" href="#collection">
              Set your own mood <Icon name="arrow" />
            </a>
          </div>
          <span className="ritual-index">THE LUMORA RITUAL</span>
        </section>
        <section
          className="gifting section-shell"
          id="gifting"
          aria-labelledby="gift-title"
        >
          <div className="gift-copy reveal">
            <p className="eyebrow">THE ART OF GIVING / 04</p>
            <h2 id="gift-title">
              A little warmth.
              <br />
              <em>A lot of meaning.</em>
            </h2>
            <p>
              A new home. A birthday. A quiet thank you. Find a fragrance for
              someone’s favourite corner of the world.
            </p>
            <a className="button button-dark" href="#collection">
              Give a little warmth <Icon name="arrow" />
            </a>
            <span className="gift-footnote">
              THOUGHTFUL GIFTS, STARTING WITH A FEELING.
            </span>
          </div>
          <div className="gift-photo depth-image" data-depth="gift">
            <img
              src="/images/photography/thoughtful-gifts.jpg"
              alt="Amber glass candles and gift packaging arranged on pale stone"
              width="1000"
              height="1100"
              loading="lazy"
              decoding="async"
            />
            <span className="gift-photo-label">
              For someone.
              <br />
              <em>Or just for you.</em>
            </span>
          </div>
        </section>
        <section
          className="care-section section-shell"
          aria-labelledby="care-title"
        >
          <div className="care-heading reveal">
            <p className="eyebrow">KEEP THE RITUAL BEAUTIFUL / 05</p>
            <h2 id="care-title">
              A little care.
              <br />
              <em>A better glow.</em>
            </h2>
            <p>Simple moments deserve a little attention.</p>
          </div>
          <div className="care-grid">
            {[
              [
                '01',
                'Trim the wick',
                'Trim to around 5 mm before lighting, and follow the care instructions on your candle’s label.',
              ],
              [
                '02',
                'Set the scene',
                'Use a stable, heat-resistant surface, away from drafts, children, pets, and anything flammable.',
              ],
              [
                '03',
                'Stay in the moment',
                'Keep a burning candle in sight. Always extinguish it before leaving the room.',
              ],
            ].map(([number, title, copy]) => (
              <article className="care-card reveal" key={number}>
                <span>{number}</span>
                <Icon name="spark" size={26} />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          className="faq-section section-shell"
          aria-labelledby="faq-title"
        >
          <div className="faq-heading reveal">
            <p className="eyebrow">GOOD TO KNOW / 06</p>
            <h2 id="faq-title">
              Before the
              <br />
              <em>first spark.</em>
            </h2>
          </div>
          <div className="faq-list">
            {[
              {
                title: 'Which scent should I choose?',
                text: 'Amber Hour and Midnight Fig are warm and woody. Quiet Forest is fresh and earthy. Rosewater is soft and floral. Open any candle’s details to explore its scent notes.',
              },
              {
                title: 'Are these the final products and prices?',
                text: 'This is a sample collection. Licensed photographs show scent moods and styling, rather than final Lumora inventory. Our approved hero is a campaign illustration. Actual product photographs, packaging, scent names, and rupee prices will be confirmed before launch.',
              },
              {
                title: 'Can I place an order here?',
                text: 'Explore the collection and build your bag. Payments remain disabled in this preview until the final catalog, delivery terms, and Razorpay setup are ready.',
              },
              {
                title: 'How do I care for my candle?',
                text: 'Trim the wick to about 5 mm and follow the instructions on the label. Always use a heat-resistant surface, keep the flame in sight, and extinguish it before leaving.',
              },
            ].map((item, index) => (
              <div className="faq-item" key={item.title}>
                <h3>
                  <button
                    aria-expanded={faq === index}
                    aria-controls={`faq-answer-${index}`}
                    onClick={() => setFaq(faq === index ? null : index)}
                  >
                    <span className="faq-number">0{index + 1}</span>
                    {item.title}
                    <Icon name={faq === index ? 'minus' : 'plus'} size={18} />
                  </button>
                </h3>
                <div id={`faq-answer-${index}`} hidden={faq !== index}>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="newsletter" aria-labelledby="newsletter-title">
          <div className="newsletter-orbit" aria-hidden="true" />
          <div className="newsletter-inner reveal">
            <p className="eyebrow">LET THE GOOD THINGS FIND YOU</p>
            <h2 id="newsletter-title">
              Stay in
              <br />
              <em>the glow.</em>
            </h2>
            <p>New scents. Small rituals. A quieter kind of inspiration.</p>
            <form onSubmit={subscribe}>
              <label className="sr-only" htmlFor="email">
                Email address
              </label>
              <div className="email-field">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="Your email address"
                  disabled={emailSubmitted}
                />
                <button
                  type="submit"
                  aria-label="Preview newsletter signup"
                  disabled={emailSubmitted}
                >
                  <Icon name={emailSubmitted ? 'check' : 'arrow'} />
                </button>
              </div>
              <p role="status">
                {emailSubmitted
                  ? 'Thank you! This signup is a preview; your email has not been sent or stored.'
                  : 'Preview signup only. We’re not collecting emails yet.'}
              </p>
            </form>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <a className="footer-wordmark" href="#">
              lumora<span>✦</span>
            </a>
            <p>A little light. An entirely different feeling.</p>
          </div>
          <nav aria-label="Footer navigation">
            <a href="#collection">The collection</a>
            <a href="#story">Our world</a>
            <a href="#gifting">Gifting</a>
            <a href="#ritual">The ritual</a>
          </nav>
          <a className="back-to-top" href="#" aria-label="Back to top">
            ↑
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Lumora</span>
          <a href="/image-credits.html">
            Photography & image credits ↗
          </a>
          <span>MADE FOR THE MOMENTS IN BETWEEN</span>
        </div>
      </footer>

      <div
        className={toast ? 'toast visible' : 'toast'}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <Icon name="check" size={18} />
            {toast}
          </>
        )}
      </div>

      <dialog
        className="product-dialog"
        ref={productDialog}
        onCancel={() => setProduct(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setProduct(null)
        }}
        aria-labelledby="product-dialog-title"
      >
        {product && (
          <div className="product-detail">
            <button
              className="icon-button modal-close"
              aria-label="Close product details"
              onClick={() => setProduct(null)}
            >
              <Icon name="close" />
            </button>
            <div
              className="detail-art"
              style={{ '--scent-color': product.color } as React.CSSProperties}
            >
              <span className="eyebrow">THE SCENT PROFILE</span>
              <span className="detail-monogram" aria-hidden="true">
                l.
              </span>
              <span className="detail-product-name">{product.name}</span>
              <p>{product.notes}</p>
              <span className="detail-profile-note">
                Explore the feeling behind the fragrance.
              </span>
            </div>
            <div className="detail-copy">
              <p className="eyebrow">{product.label}</p>
              <h2 id="product-dialog-title">{product.name}</h2>
              <p className="detail-price">{formatPrice(product.price)}</p>
              <p>{product.description}</p>
              <div className="scent-notes">
                <span className="eyebrow">SCENT NOTES</span>
                <p>{product.notes}</p>
              </div>
              <p className="detail-disclaimer">
                Sample product. Photography is for mood and styling. Actual
                product photos, size, wax blend, burn time, and final price will
                be confirmed before launch.
              </p>
              <button
                className="button button-dark"
                onClick={() => addToCart(product.id)}
              >
                {toast === `${product.name} added to your bag`
                  ? 'Added to bag'
                  : 'Add to bag'}{' '}
                <Icon
                  name={
                    toast === `${product.name} added to your bag`
                      ? 'check'
                      : 'plus'
                  }
                  size={18}
                />
              </button>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        className="cart-dialog"
        ref={cartDialog}
        onCancel={() => setCartOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setCartOpen(false)
        }}
        aria-labelledby="cart-title"
      >
        <div className="cart-content">
          <div className="cart-heading">
            <h2 id="cart-title">
              Your bag <span>({count})</span>
            </h2>
            <button
              className="icon-button"
              onClick={() => setCartOpen(false)}
              aria-label="Close shopping bag"
            >
              <Icon name="close" />
            </button>
          </div>
          {cart.length === 0 ? (
            <div className="empty-cart">
              <Icon name="bag" size={42} />
              <h3>
                {receipt
                  ? 'Your glow is on its way.'
                  : 'A little room for a glow.'}
              </h3>
              <p>
                {receipt
                  ? `Payment confirmed. Order reference: ${receipt}`
                  : 'Your bag is waiting for its first candle.'}
              </p>
              <button
                className="button button-dark"
                onClick={() => {
                  setCartOpen(false)
                  document.getElementById('collection')?.scrollIntoView({
                    behavior: window.matchMedia(
                      '(prefers-reduced-motion: reduce)',
                    ).matches
                      ? 'instant'
                      : 'smooth',
                  })
                }}
              >
                Explore the collection <Icon name="arrow" />
              </button>
            </div>
          ) : (
            <>
              <div className="cart-items">
                {cart.map((item) => {
                  const candle = products.find(
                    (product) => product.id === item.id,
                  )!
                  return (
                    <div className="cart-item" key={item.id}>
                      <div
                        className="cart-item-art"
                        style={
                          {
                            '--scent-color': candle.color,
                          } as React.CSSProperties
                        }
                        aria-hidden="true"
                      >
                        <span>l.</span>
                      </div>
                      <div className="cart-item-info">
                        <h3>{candle.name}</h3>
                        <p>{formatPrice(candle.price)} each</p>
                        <div className="quantity-control">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            aria-label={`Decrease ${candle.name} quantity`}
                          >
                            <Icon name="minus" size={14} />
                          </button>
                          <span aria-label={`${candle.name} quantity`}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={item.quantity >= 99}
                            aria-label={`Increase ${candle.name} quantity`}
                          >
                            <Icon name="plus" size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="cart-item-total">
                        <span>{formatPrice(candle.price * item.quantity)}</span>
                        <button
                          onClick={() => {
                            setCart((items) =>
                              items.filter((entry) => entry.id !== item.id),
                            )
                            setCheckout(false)
                          }}
                          aria-label={`Remove ${candle.name} from bag`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="cart-summary">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </div>
                <p>Sample prices. Shipping and taxes are not configured.</p>
                <button
                  className="button button-dark"
                  onClick={() => setCheckout(true)}
                >
                  Continue to checkout <Icon name="arrow" />
                </button>
                {checkout && (
                  <Checkout
                    items={cart}
                    subtotal={subtotal}
                    onPaymentWindowOpen={() => {
                      cartDialog.current?.close()
                      setCartOpen(false)
                    }}
                    onPaymentWindowClose={() => setCartOpen(true)}
                    onPaid={(orderReceipt, purchased) => {
                      setCart((current) =>
                        current
                          .map((item) => ({
                            ...item,
                            quantity:
                              item.quantity -
                              (purchased.find((paid) => paid.id === item.id)
                                ?.quantity || 0),
                          }))
                          .filter((item) => item.quantity > 0),
                      )
                      setReceipt(orderReceipt)
                      setCheckout(false)
                      setCartOpen(true)
                      setToast(`Payment confirmed. Order ${orderReceipt}`)
                    }}
                  />
                )}
                <button
                  className="continue-shopping"
                  onClick={() => setCartOpen(false)}
                >
                  Continue exploring
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  )
}
