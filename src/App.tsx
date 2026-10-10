import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import CandleArt from './components/CandleArt'
import Checkout from './components/Checkout'
import { products, formatPrice } from './products'
import type { Product, Mood } from './products'
import './App.css'

const CandleScene = lazy(() => import('./components/CandleScene'))
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

export default function App() {
  const [mood, setMood] = useState(0)
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
  const heroProduct = products[mood]
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
      <div className="announcement">
        A little light. A moment for yourself. <span>Meet Lumora.</span>
      </div>
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Lumora home">
          lumora<span>✳</span>
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
            Our story
          </a>
          <a href="#ritual" onClick={navigate}>
            The ritual
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
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-sun">✳</span> A softer kind of everyday
            </p>
            <h1 id="hero-title">
              A little light.
              <br />A <em>softer</em> life.
            </h1>
            <p className="hero-description">
              Scent, warmth, and a moment to pause.
              <br />
              Meet candles that make a space feel like you.
            </p>
            <a className="button button-dark" href="#collection">
              Find your glow <Icon name="arrow" />
            </a>
            <div className="hero-footnote">
              <span className="small-line" />
              For quiet mornings & slow evenings.
            </div>
          </div>
          <div
            className="hero-art"
            style={
              { '--scene-color': heroProduct.color } as React.CSSProperties
            }
          >
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="scene-halo" />
            <div className="scene-shadow" />
            <div className="art-caption caption-top">
              <span>THE EVERYDAY RITUAL</span>
              <span>01 / {String(mood + 1).padStart(2, '0')}</span>
            </div>
            <Suspense
              fallback={
                <CandleArt
                  className="scene-loading"
                  name={heroProduct.name}
                  color={heroProduct.color}
                />
              }
            >
              <CandleScene color={heroProduct.color} name={heroProduct.name} />
            </Suspense>
            <div className="hero-product-label">
              <span className="eyebrow">Your current mood</span>
              <strong>{heroProduct.name}</strong>
              <span>{heroProduct.notes}</span>
            </div>
            <div
              className="mood-picker"
              aria-label="Choose a candle to explore"
            >
              {products.slice(0, 3).map((item, index) => (
                <button
                  key={item.id}
                  className={mood === index ? 'mood-dot active' : 'mood-dot'}
                  onClick={() => setMood(index)}
                  aria-label={`Explore ${item.name}`}
                  aria-pressed={mood === index}
                  style={{ '--dot-color': item.color } as React.CSSProperties}
                />
              ))}
            </div>
            <span className="interaction-hint">
              Move a little. Watch it glow.
            </span>
          </div>
          <a className="hero-scroll" href="#collection">
            <span>Keep exploring</span>
            <span>↓</span>
          </a>
        </section>

        <div className="brand-strip">
          <span>
            <Icon name="spark" /> A glow for every mood
          </span>
          <span>
            <Icon name="leaf" /> Inspired by the natural world
          </span>
          <span>
            <Icon name="spark" /> Made for your daily rituals
          </span>
        </div>

        <section
          className="collection section-shell"
          id="collection"
          aria-labelledby="collection-title"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE LUMORA COLLECTION</p>
              <h2 id="collection-title">
                Find your <em>kind of calm.</em>
              </h2>
            </div>
            <p>
              A scent for the moment.
              <br />A little something, just for you.
            </p>
          </div>
          <div className="collection-toolbar">
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
            <span className="catalog-note">
              Sample collection · prices in INR
            </span>
          </div>
          <div className="product-grid">
            {products
              .filter((item) => filter === 'all' || item.category === filter)
              .map((item) => (
                <article className="product-card" key={item.id}>
                  <button
                    className="product-visual"
                    style={{ background: item.backdrop }}
                    onClick={() => setProduct(item)}
                    aria-label={`View ${item.name} candle details`}
                  >
                    <span className="product-tag">{item.label}</span>
                    <CandleArt name={item.name} color={item.color} />
                    <span className="product-view">
                      Discover the scent <Icon name="arrow" size={16} />
                    </span>
                  </button>
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
                    Add to bag <Icon name="plus" size={16} />
                  </button>
                </article>
              ))}
          </div>
        </section>

        <section className="story" id="story" aria-labelledby="story-title">
          <div className="story-art">
            <div className="story-sun" />
            <div className="story-arch" />
            <div className="story-plinth" />
            <CandleArt color="#59634a" name="Quiet Forest" />
            <span className="story-art-label">
              LESS HURRY.
              <br />
              MORE HERE.
            </span>
            <span className="story-art-number">L / 01</span>
          </div>
          <div className="story-copy">
            <p className="eyebrow">THE HEART OF LUMORA</p>
            <h2 id="story-title">
              Life moves fast.
              <br />
              <em>Let’s slow it down.</em>
            </h2>
            <p>
              Lumora is a celebration of the small things: a familiar room, a
              favourite scent, the gentle glow at the end of a long day.
            </p>
            <p>
              We’re building a world of candles around a simple idea. Your
              everyday spaces deserve a little warmth, and you deserve a moment
              that’s entirely yours.
            </p>
            <a className="text-link" href="#ritual">
              Make room for a ritual <Icon name="arrow" size={18} />
            </a>
            <div className="story-signature">
              With a little light,
              <br />
              <span>Lumora</span>
            </div>
          </div>
        </section>

        <section
          className="ritual section-shell"
          id="ritual"
          aria-labelledby="ritual-title"
        >
          <div className="ritual-heading">
            <p className="eyebrow">A SMALL RITUAL. A REAL MOMENT.</p>
            <h2 id="ritual-title">
              Good things start <em>with a spark.</em>
            </h2>
          </div>
          <div className="ritual-grid">
            {[
              {
                number: '01',
                title: 'Choose your mood',
                copy: 'Bright and fresh, warm and woody, or beautifully floral. Follow the feeling.',
              },
              {
                number: '02',
                title: 'Set the scene',
                copy: 'Place your candle on a stable, heat-resistant surface, away from anything flammable.',
              },
              {
                number: '03',
                title: 'Be here, now',
                copy: 'Light the wick. Settle in. Always keep your candle in sight, and extinguish it before leaving.',
              },
            ].map((step) => (
              <div className="ritual-step" key={step.number}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="quote-section">
          <span className="quote-symbol">✳</span>
          <p>
            Not just a candle.
            <br />
            <em>A feeling you come home to.</em>
          </p>
          <span className="eyebrow">THAT’S THE LUMORA WAY</span>
        </section>

        <section
          className="faq-section section-shell"
          aria-labelledby="faq-title"
        >
          <div>
            <p className="eyebrow">A LITTLE MORE TO KNOW</p>
            <h2 id="faq-title">
              Before you
              <br />
              <em>light up.</em>
            </h2>
          </div>
          <div className="faq-list">
            {[
              {
                title: 'How do I care for my candle?',
                text: 'Trim the wick to about 5 mm before lighting. Keep the candle on a heat-resistant surface and follow the safety instructions on its label. Never leave a burning candle unattended.',
              },
              {
                title: 'Which scent should I choose?',
                text: 'Amber Hour and Midnight Fig are warm and woody. Quiet Forest is fresh and earthy. Rosewater is soft and floral. Open any candle’s details to explore its scent notes.',
              },
              {
                title: 'Can I place an order here?',
                text: 'You can explore the sample collection and build a shopping bag. Razorpay checkout is available once the store is enabled. During this preview, payments remain disabled while the final catalog, delivery terms, and fulfilment are confirmed.',
              },
              {
                title: 'Are these the final products and prices?',
                text: 'This is a preview collection with sample candle names, descriptions, and prices in Indian rupees. The final catalog, ingredients, sizes, and delivery terms will be confirmed before the store launches.',
              },
            ].map((item, index) => (
              <div className="faq-item" key={item.title}>
                <h3>
                  <button
                    aria-expanded={faq === index}
                    aria-controls={`faq-answer-${index}`}
                    onClick={() => setFaq(faq === index ? null : index)}
                  >
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

        <section className="newsletter">
          <div>
            <p className="eyebrow">STAY IN THE GLOW</p>
            <h2>
              A little light <em>in your inbox.</em>
            </h2>
            <p>New scents, small rituals, and things worth slowing down for.</p>
          </div>
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
                ? 'You’re interested — thank you! Signup is a preview; your email has not been sent or stored.'
                : 'Preview signup only. We’re not collecting emails yet.'}
            </p>
          </form>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-top">
          <a className="wordmark" href="#">
            lumora<span>✳</span>
          </a>
          <p>
            Find your glow.
            <br />
            Make yourself at home.
          </p>
          <nav aria-label="Footer navigation">
            <a href="#collection">Shop the collection</a>
            <a href="#story">Our story</a>
            <a href="#ritual">Candle care</a>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Lumora</span>
          <span>Candle portfolio & storefront</span>
          <a href="#">Back to the light ↑</a>
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
              style={{ background: product.backdrop }}
            >
              <CandleArt name={product.name} color={product.color} />
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
                Sample product. Size, wax blend, burn time, and final price will
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
                        style={{ background: candle.backdrop }}
                      >
                        <CandleArt name={candle.name} color={candle.color} />
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
