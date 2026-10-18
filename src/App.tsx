import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import Checkout from './components/Checkout'
import Intro from './components/Intro'
import Modal from './components/Modal'
import useStoreMotion from './useStoreMotion'
import { products, formatPrice } from './products'
import type { Category, Product } from './products'
import './App.css'

type Bag = Record<string, number>
type Sort = 'featured' | 'low' | 'high'
type DialogName = 'product' | 'bag' | 'checkout' | 'events' | null
type CheckoutMode = 'demo' | 'payment' | 'demo-complete' | 'paid'
const bagKey = 'stillwick-bag' // Retained from the approved prototype for bag continuity.
function readBag(): Bag {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(bagKey) || '{}')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
    return Object.fromEntries(products.flatMap((product) => {
      const value = (saved as Record<string, unknown>)[product.id]
      return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 99
        ? [[product.id, value]] : []
    }))
  } catch { return {} }
}

export default function App() {
  const [category, setCategory] = useState<Category | 'All'>('All')
  const [sort, setSort] = useState<Sort>('featured')
  const [cart, setCart] = useState<Bag>(readBag)
  const [modal, setModal] = useState<DialogName>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [toast, setToast] = useState('')
  const [lastAdded, setLastAdded] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)
  const [introActive, setIntroActive] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [introRun, setIntroRun] = useState(0)
  const introOpener = useRef<HTMLElement | null>(null)
  const restoreIntroFocus = useRef(false)
  const [checkoutReady, setCheckoutReady] = useState(false)
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>('demo')
  const [paymentWindowOpen, setPaymentWindowOpen] = useState(false)
  const [checkoutItems, setCheckoutItems] = useState<{ id: string; quantity: number }[]>([])
  const [checkoutSubtotal, setCheckoutSubtotal] = useState(0)
  const [receipt, setReceipt] = useState('')
  const eventForm = useRef<HTMLFormElement>(null)
  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  const subtotal = products.reduce((sum, item) => sum + item.price * (cart[item.id] || 0), 0)
  const visibleProducts = products.filter((item) => category === 'All' || item.category.includes(category))
  if (sort !== 'featured') visibleProducts.sort((a, b) => sort === 'low' ? a.price - b.price : b.price - a.price)
  useStoreMotion(category, sort)

  useEffect(() => {
    try { localStorage.setItem(bagKey, JSON.stringify(cart)) } catch { /* In-memory bag remains usable. */ }
  }, [cart])
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/store', { signal: controller.signal }).then(async (response) => {
      if (response.ok) setCheckoutReady((await response.json()).checkoutReady === true)
    }).catch(() => { /* The supplied demo checkout remains available without a backend. */ })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (introActive || !restoreIntroFocus.current) return
    const frame = requestAnimationFrame(() => {
      const target = introOpener.current?.isConnected ? introOpener.current : document.getElementById('main')
      target?.focus({ preventScroll: true })
      restoreIntroFocus.current = false
    })
    return () => cancelAnimationFrame(frame)
  }, [introActive])
  const finishIntro = useCallback(() => {
    document.documentElement.classList.remove('intro-pending')
    document.documentElement.classList.add('entrance-visible')
    restoreIntroFocus.current = true
    setIntroActive(false)
  }, [])
  const notify = (message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => { setToast(''); setLastAdded('') }, 2600)
  }
  const add = (id: string) => {
    if (!products.some((item) => item.id === id)) return
    if ((cart[id] || 0) >= 99) { notify('Maximum 99 per item in this preview'); return }
    setCart((saved) => ({ ...saved, [id]: Math.min(99, (saved[id] || 0) + 1) }))
    setLastAdded(id)
    notify('A little lovely, added to your bag.')
  }
  const changeQuantity = (id: string, delta: number) => setCart((saved) => {
    const next = { ...saved }
    const quantity = Math.max(0, Math.min(99, (saved[id] || 0) + delta))
    if (quantity) next[id] = quantity
    else delete next[id]
    return next
  })
  const remove = (id: string) => setCart((saved) => {
    const next = { ...saved }; delete next[id]; return next
  })
  const removePurchased = (purchased: { id: string; quantity: number }[]) => setCart((saved) => {
    const next = { ...saved }
    for (const item of purchased) {
      const left = (next[item.id] || 0) - item.quantity
      if (left > 0) next[item.id] = left
      else delete next[item.id]
    }
    return next
  })
  const handlePageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return
    const element = event.target.closest<HTMLElement>('button,a')
    if (!element) return
    if (element.dataset.add) { add(element.dataset.add); return }
    if (element.dataset.product) {
      const selected = products.find((item) => item.id === element.dataset.product)
      if (selected) { setProduct(selected); setModal('product') }
      return
    }
    const filter = element.dataset.filter || element.dataset.category
    if (filter && ['All', 'Home', 'Gifting', 'Sculptural'].includes(filter)) setCategory(filter as Category | 'All')
    if (element.id === 'bag') setModal('bag')
    if (element.id === 'events') { eventForm.current?.reset(); setModal('events') }
    if (element.id === 'prototypeInfo') notify('Design prototype · Auraflare · Sample catalogue and demo checkout.')
    if (element.id === 'replayIntro' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      introOpener.current = element
      setIntroRun((run) => run + 1)
      setIntroActive(true)
    }
  }
  const close = () => setModal(null)
  const beginCheckout = () => {
    setCheckoutItems(products.filter((item) => cart[item.id]).map((item) => ({ id: item.id, quantity: cart[item.id] })))
    setCheckoutSubtotal(subtotal)
    setCheckoutMode(checkoutReady ? 'payment' : 'demo')
    setPaymentWindowOpen(false)
    setModal('checkout')
  }
  const finishDemo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.currentTarget.reset()
    removePurchased(checkoutItems)
    setCheckoutMode('demo-complete')
  }

  return (
    <>
      {introActive && <Intro key={introRun} onFinish={finishIntro} />}
      <div className="page-content" inert={introActive} onClick={handlePageClick}>

<a className="skip" href="#main">Skip to content</a>
<div className="announcement">A LITTLE LIGHT. A LITTLE LESS HURRY. <span>Discover your everyday ritual ↗</span>
</div>

<header><a className="brand" href="#">Auraflare<span className="brand-flame">◒</span>
<small>THE CANDLE STUDIO</small>
</a>
<nav aria-label="Main navigation"><a href="#collection" data-filter="All">Shop candles</a>
<a href="#collection" data-filter="Gifting">The gifting edit</a>
<a href="#occasions">Weddings &amp; events</a>
<a href="#story">Our world</a>
</nav>
<button className="bag" id="bag" aria-label={'Open shopping bag, ' + count + ' items'}>Bag <span id="count">{count}</span>
 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Zm4 0V6a3 3 0 0 1 6 0v2"></path>
</svg>
</button>
</header>

<main id="main" tabIndex={-1}><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="line"></span>
 FOR THE BEAUTY OF EVERYDAY</div>
<h1>A little light.<br />A <em>slower</em>
<br />moment.</h1>
<p>Candles for quiet evenings, thoughtful gifts,<br className="desktop" /> and the moments you want to hold onto.</p>
<a className="button" href="#collection">Find your glow <span>↗</span>
</a>
<a className="text-link" href="#occasions">Something for a special occasion? <span>→</span>
</a>
<div className="hero-bottom"><span>HOME · GIFTS · CELEBRATIONS</span>
<span>SCROLL TO SLOW DOWN ↓</span>
</div>
</div>
<div className="hero-photo"><img src="/images/auraflare/hero.webp" alt="Glowing jar, bubble and flower candles surrounded by delicate white flowers" fetchPriority="high" /><div className="photo-label">The art of a softer evening.<span>01 / THE EVERYDAY RITUAL</span>
</div>
<div className="seal">little things<br /><i>lovely</i>
<br />moments</div>
</div>
</section>

<div className="ribbon"><span>Light up your space</span>
<b>✳</b>
<span>Give a little warmth</span>
<b>✳</b>
<span>Make a moment of it</span>
<b>✳</b>
<span>Find your kind of glow</span>
</div>

<section className="collection section" id="collection"><div className="section-top"><div><div className="eyebrow">THE CANDLE EDIT</div>
<h2>Small details.<br /><em>Beautiful rituals.</em>
</h2>
</div>
<p>A shape for every corner.<br />A little warmth for every kind of day.</p>
</div>
<div className="shop-tools"><div className="filters" role="group" aria-label="Filter candle collection"><button className={category === 'All' ? 'active' : ''} data-category="All" aria-pressed={category === 'All'}>All candles</button>
<button className={category === 'Home' ? 'active' : ''} data-category="Home" aria-pressed={category === 'Home'}>For your home</button>
<button className={category === 'Gifting' ? 'active' : ''} data-category="Gifting" aria-pressed={category === 'Gifting'}>For gifting</button>
<button className={category === 'Sculptural' ? 'active' : ''} data-category="Sculptural" aria-pressed={category === 'Sculptural'}>Sculptural</button>
</div>
<label className="sort">Sort by <select id="sort" aria-label="Sort candles" value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="featured">Featured</option>
<option value="low">Price: low to high</option>
<option value="high">Price: high to low</option>
</select>
</label>
</div>
<div className="products" id="products">{visibleProducts.map((item) => <article className="product" key={item.id}>
<div className="product-photo"><button className="product-open" data-product={item.id} aria-label={'View ' + item.name}><img src={item.image} alt={item.name + ', ' + item.note} loading="lazy" decoding="async" /><span className="badge">{item.tag}</span></button><button className="quick-add" data-add={item.id} aria-label={'Add ' + item.name + ' to bag'}>+</button></div>
<button className="product-open" data-product={item.id}><div className="product-info"><h3>{item.name}</h3><span className="price">{formatPrice(item.price)}</span></div><p>{item.note}</p></button></article>)}</div><p className="sample-note">A curated preview · Product names and prices are illustrative.</p>
</section>

<section className="pause" id="story"><div className="pause-photo"><img src="/images/auraflare/pillars.webp" alt="Two ivory ribbed pillar candles on a textured ceramic tray" loading="lazy" /></div>
<div className="pause-copy"><div className="eyebrow">A SPACE TO EXHALE</div>
<h2>Less rush.<br />More <em>ritual.</em>
</h2>
<p>Pull up your favourite chair. Put your phone aside. Let the room become a little softer.</p>
<p>Whether it’s the sculptural detail on your shelf or the glow at the end of a long day, make a little room for the things that feel good.</p>
<a className="text-link" href="#collection" data-filter="Home">Bring the feeling home <span>↗</span>
</a>
<span className="handwritten">Make ordinary feel lovely.</span>
</div>
</section>

<section className="occasions section" id="occasions"><div className="section-top"><div><div className="eyebrow">THOUGHTFUL BY NATURE</div>
<h2>For you.<br />For them. <em>For the moment.</em>
</h2>
</div>
</div>
<div className="occasion-grid"><a className="occasion" href="#collection" data-filter="Home"><img src="/images/auraflare/glass.webp" alt="Three glowing candles in glass cylinders" loading="lazy" /><div><small>01 / EVERYDAY LIVING</small>
<h3>A softer kind of home</h3>
<span>Explore home candles ↗</span>
</div>
</a>
<a className="occasion" href="#collection" data-filter="Gifting"><img src="/images/auraflare/hearts.webp" alt="Heart-shaped candles with rose petals" loading="lazy" /><div><small>02 / JUST BECAUSE</small>
<h3>A gift that feels personal</h3>
<span>Discover the gifting edit ↗</span>
</div>
</a>
<button className="occasion" id="events"><img src="/images/auraflare/tealights.webp" alt="Floating tealights and rose petals for a celebration" loading="lazy" /><div><small>03 / THE BIG LITTLE MOMENTS</small>
<h3>Set the scene for love</h3>
<span>Plan wedding &amp; event candles ↗</span>
</div>
</button>
</div>
</section>

<section className="care section" id="care"><div><div className="eyebrow">A LITTLE CANDLE WISDOM</div>
<h2>Keep the <em>glow</em>
 going.</h2>
</div>
<div className="faq"><details><summary>How do I care for my candle?<span>+</span>
</summary>
<p>Trim the wick before each use and follow the care instructions supplied with your candle. Keep the wax free of debris and place the candle on a stable, heat-resistant surface.</p>
</details>
<details><summary>Can I burn sculptural candles?<span>+</span>
</summary>
<p>Use a heat-resistant tray to catch melted wax. Shape and size affect how the wax melts; check the product’s individual care guidance before lighting.</p>
</details>
<details><summary>Can I personalise gifts or event orders?<span>+</span>
</summary>
<p>Tell us about your occasion using the event enquiry form. This prototype previews the enquiry experience; available colours, packaging and customisation will be confirmed by the studio.</p>
</details>
<details><summary>What should I know before ordering?<span>+</span>
</summary>
<p>This is a design prototype with sample products and prices. Shipping, delivery times, returns and payment options will be confirmed when the store launches.</p>
</details>
</div>
</section>

<section className="closing"><span>THERE’S ALWAYS ROOM FOR</span>
<h2>A little more <em>light.</em>
</h2>
<a className="button light" href="#collection">Discover the collection ↗</a>
</section>
</main>

<footer><div><a className="brand" href="#">Auraflare<span>◒</span>
<small>THE CANDLE STUDIO</small>
</a>
<p>Small rituals. Lovely moments.</p>
</div>
<div><h4>Explore</h4>
<a href="#collection" data-filter="All">All candles</a>
<a href="#collection" data-filter="Gifting">Gifts</a>
<a href="#occasions">Weddings &amp; events</a>
</div>
<div><h4>A little help</h4>
<a href="#story">Our world</a>
<a href="#care" id="careLink">Candle care</a>
<button id="prototypeInfo">About this preview</button>
<button id="replayIntro">Replay introduction ↗</button>
</div>
<div className="footer-note">A warm beginning.<br /><em>A beautiful everyday.</em>
<small>A candle for your space. A glow for your moments.</small>
</div>
<div className="footer-bottom"><span>© 2026 Auraflare · Design concept</span>
<span>Made for moments that matter.</span>
</div>
</footer>




      </div>
      <Modal id="productDialog" className="product-dialog" label="Candle details" open={modal === 'product'} onDismiss={close}>
        <button className="close" aria-label="Close product details" onClick={close}>×</button>
        {product && <div className="product-detail">
          <img src={product.image} alt={product.name} />
          <div className="detail-copy">
            <div className="eyebrow">{product.tag}</div><h2>{product.name}</h2>
            <p>{product.description}</p><p className="detail-price">{formatPrice(product.price)}</p>
            <label>Style<select aria-label="Candle style" defaultValue={product.note}><option>{product.note}</option></select></label>
            <p>For your home, or someone you love.</p>
            <button className="button" onClick={() => add(product.id)}>{lastAdded === product.id ? 'Added to bag' : 'Add to bag'} <span>{lastAdded === product.id ? '✓' : '+'}</span></button>
            <p className="sample-note">Concept product · Sample price. Materials, scent, size and burn time will be added to the final catalogue.</p>
            <details><summary>Candle care</summary><p>Always use a stable, heat-resistant surface. Never leave a burning candle unattended. Keep away from children, pets and flammable materials.</p></details>
          </div>
        </div>}
      </Modal>
      <Modal id="cartDialog" className="cart-dialog" label="Shopping bag" open={modal === 'bag'} onDismiss={close}>
        <div className="dialog-head"><h2>Your <em>bag.</em></h2><button className="close" aria-label="Close bag" onClick={close}>×</button></div>
        {count ? <>
          <p className="sample-note">A little collection of lovely things.</p>
          {products.filter((item) => cart[item.id]).map((item) => <div className="cart-item" key={item.id}>
            <img src={item.image} alt={item.name} />
            <div><h3>{item.name}</h3><small>{item.note}</small><div className="qty">
              <button onClick={() => changeQuantity(item.id, -1)} aria-label={'Decrease ' + item.name + ' quantity'}>−</button>
              <span aria-label={item.name + ' quantity'}>{cart[item.id]}</span>
              <button onClick={() => changeQuantity(item.id, 1)} disabled={cart[item.id] >= 99} aria-label={'Increase ' + item.name + ' quantity'}>+</button>
            </div></div>
            <div>{formatPrice(item.price * cart[item.id])}<p><button className="remove" onClick={() => remove(item.id)} aria-label={'Remove ' + item.name}>Remove</button></p></div>
          </div>)}
          <div className="cart-total"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
          <p className="sample-note">Shipping and any applicable taxes will be confirmed in the live store.</p>
          <button className="button" onClick={beginCheckout}>Continue to checkout <span>↗</span></button>
          {!checkoutReady && <p className="sample-note">Design preview · No real payment will be collected.</p>}
        </> : <div className="empty"><h3>Your next little ritual awaits.</h3><p>Explore the collection and find your kind of glow.</p>
          <button className="button" onClick={() => { close(); document.getElementById('collection')?.scrollIntoView() }}>Discover the candles ↗</button></div>}
      </Modal>
      <Modal id="checkoutDialog" className="checkout-dialog" label={checkoutMode === 'payment' ? 'Secure checkout' : 'Demo checkout'} open={modal === 'checkout' && !paymentWindowOpen} onDismiss={close}>
        <button className="close" aria-label="Close checkout" onClick={close}>×</button>
        {(checkoutMode === 'demo-complete' || checkoutMode === 'paid') ? <div className="success">
          <span className="success-mark" aria-hidden="true">✳</span>
          <div className="eyebrow">{checkoutMode === 'paid' ? 'PAYMENT CONFIRMED' : 'A LITTLE LOVELY, ON ITS WAY — IN DEMO'}</div>
          <h2>That’s a <em>lovely</em> choice.</h2>
          {checkoutMode === 'paid' ? <p>Payment confirmed. Order reference: {receipt}</p> : <>
            <p>You’ve completed the sample checkout for {formatPrice(checkoutSubtotal)}. No real order or payment has been created.</p>
            <p>Your delivery details have not been saved.</p>
          </>}
          <button className="button" onClick={() => { close(); document.getElementById('collection')?.scrollIntoView() }}>Back to the collection ↗</button>
        </div> : <>
          <div className="eyebrow">ONE LAST LITTLE STEP</div><h2>Bring the <em>glow</em> home.</h2>
          {checkoutMode === 'demo' && <div className="demo-banner">Demo checkout · No order is placed, no payment is collected, and no personal details are saved. Use sample details to explore.</div>}
          <div className="checkout-summary">
            {checkoutItems.map((item) => <div key={item.id}>{products.find((candle) => candle.id === item.id)!.name} × {item.quantity} — {formatPrice(products.find((candle) => candle.id === item.id)!.price * item.quantity)}</div>)}
            <div className="cart-total"><span>{checkoutMode === 'demo' ? 'Demo subtotal' : 'Subtotal'}</span><strong>{formatPrice(checkoutSubtotal)}</strong></div>
            {checkoutMode === 'demo' && 'Shipping & taxes: confirmed in the live store'}
          </div>
          {checkoutMode === 'payment' ? <Checkout items={checkoutItems} subtotal={checkoutSubtotal}
            onPaymentWindowOpen={() => setPaymentWindowOpen(true)} onPaymentWindowClose={() => setPaymentWindowOpen(false)}
            onPaid={(reference, items) => { setReceipt(reference); removePurchased(items); setCheckoutMode('paid') }}
          /> : <form id="checkoutForm" onSubmit={finishDemo}>
            <div className="form-row"><label>Full name<input name="name" required autoComplete="name" placeholder="Your name" maxLength={100} /></label><label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" maxLength={150} /></label></div>
            <label>Delivery address<input name="address" required autoComplete="street-address" placeholder="House, street and area" maxLength={250} /></label>
            <div className="form-row"><label>City<input name="city" required autoComplete="address-level2" maxLength={80} /></label><label>PIN code<input name="postalCode" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="postal-code" title="Enter a six-digit PIN code" /></label></div>
            <label>Gift note (optional)<textarea name="note" maxLength={300} placeholder="A little message for someone lovely…" rows={2} /></label>
            <div className="demo-banner">Payment: simulated for this preview. The live store will connect to a payment provider.</div>
            <button className="button checkout-submit" type="submit">Complete demo order <span>↗</span></button>
          </form>}
        </>}
      </Modal>
      <Modal id="eventDialog" className="event-dialog" label="Wedding and event enquiry" open={modal === 'events'} onDismiss={() => { eventForm.current?.reset(); close() }}>
        <button className="close" aria-label="Close enquiry" onClick={() => { eventForm.current?.reset(); close() }}>×</button>
        <div className="eyebrow">WEDDINGS & CELEBRATIONS</div><h2>Let’s make it <em>lovely.</em></h2><p>Tell us a little about your day.</p>
        <form ref={eventForm} id="eventForm" onSubmit={(event) => { event.preventDefault(); event.currentTarget.reset(); close(); notify('Enquiry preview complete. No message has been sent.') }}>
          <label>Your name<input name="name" autoComplete="name" required maxLength={100} /></label>
          <label>Email<input type="email" name="email" autoComplete="email" required maxLength={150} /></label>
          <div className="form-row"><label>Occasion<select name="occasion"><option>Wedding</option><option>Celebration</option><option>Corporate gifting</option></select></label><label>Approximate quantity<input type="number" name="quantity" min="1" max="100000" required /></label></div>
          <label>What do you have in mind?<textarea name="message" rows={3} required maxLength={2000} placeholder="Colours, candle styles, date, and any special details…" /></label>
          <p className="sample-note">Demo form · Your details won’t be sent or stored.</p>
          <button className="button" type="submit">Preview enquiry <span>↗</span></button>
        </form>
      </Modal>
      <div className={'toast' + (toast ? ' visible' : '')} id="toast" role="status" aria-live="polite">{toast}</div>
    </>
  )
}
