import { cloneElement, useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactElement, ReactNode } from 'react'
import { api, ApiError, imageData, setCsrf } from './api'
import { previewSnapshot } from './preview'
import { date, initials, money } from './types'
import type {
  Content,
  Enquiry,
  Invitation,
  Order,
  Page,
  Product,
  Snapshot,
  User,
  Variant,
} from './types'
import Icon from './Icon'
import './Admin.css'

type Drawer = {
  kind:
    | 'order'
    | 'new-order'
    | 'product'
    | 'stock'
    | 'enquiry'
    | 'new-enquiry'
    | 'member'
    | 'invite'
    | 'invitation'
    | 'notifications'
  id?: string
  invitation?: Invitation
}
type Save = (
  path: string,
  method: string,
  data?: unknown,
  message?: string,
) => Promise<void>
const pages: Record<Page, string> = {
  overview: 'Overview',
  orders: 'Orders',
  products: 'Products',
  inventory: 'Inventory',
  enquiries: 'Enquiries',
  content: 'Website content',
  team: 'Team & access',
  profile: 'My profile',
}
const website = () => new URL('./', location.href).href
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'This action could not be completed.'
function Badge({ value }: { value: string }) {
  return (
    <span
      className={
        'badge ' +
        (['Paid', 'Delivered', 'Active', 'Resolved'].includes(value)
          ? 'green'
          : ['Awaiting payment', 'Pending', 'Low stock', 'New'].includes(value)
            ? 'amber'
            : ['Out of stock', 'Cancelled', 'Inactive'].includes(value)
              ? 'red'
              : '')
      }
    >
      {value}
    </span>
  )
}
function Button({
  children,
  onClick,
  primary = false,
  icon,
  disabled = false,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  primary?: boolean
  icon?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      className={'btn' + (primary ? ' primary' : '')}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}
function Art({ image, name }: { image?: string; name?: string }) {
  return (
    <div className="art">
      {image ? (
        <img src={image} alt={name || ''} loading="lazy" />
      ) : (
        <span className="muted">No image</span>
      )}
    </div>
  )
}
function StudioArt() {
  return (
    <svg viewBox="0 0 160 160" aria-hidden="true">
      <defs>
        <linearGradient id="studio-jar">
          <stop stopColor="#43212e" />
          <stop offset=".4" stopColor="#6d3b46" />
          <stop offset=".8" stopColor="#6d3b46" />
          <stop offset="1" stopColor="#43212e" />
        </linearGradient>
        <radialGradient id="studio-shadow">
          <stop stopColor="#160912" stopOpacity=".4" />
          <stop offset="1" stopColor="#160912" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="83" cy="139" rx="58" ry="12" fill="url(#studio-shadow)" />
      <path
        d="M43 53Q80 43 117 53L113 130Q80 145 47 130Z"
        fill="url(#studio-jar)"
      />
      <ellipse cx="80" cy="53" rx="37" ry="9" fill="#43212e" />
      <ellipse cx="80" cy="52" rx="31" ry="6" fill="#e6d5b6" />
      <path d="M80 49v-8" stroke="#473324" strokeWidth="2" />
      <path d="M80 42C68 35 82 22 80 17c15 16 10 23 0 25" fill="#e2ac69" />
      <path d="M80 40c-5-4 1-11 1-14 6 9 5 12-1 14" fill="#fff1bd" />
      <rect x="53" y="76" width="54" height="38" rx="1" fill="#d9b887" />
      <text
        x="80"
        y="90"
        textAnchor="middle"
        fontFamily="Georgia"
        fontSize="9"
        fill="#4c3029"
      >
        Auraflare
      </text>
      <text
        x="80"
        y="100"
        textAnchor="middle"
        fontSize="3.6"
        letterSpacing="1"
        fill="#6a4b36"
      >
        HAND POURED · WITH CARE
      </text>
      <path
        d="M50 61l2 63"
        stroke="white"
        strokeOpacity=".12"
        strokeWidth="3"
      />
    </svg>
  )
}
function Avatar({ user }: { user: User }) {
  return user.avatar ? (
    <img src={'/api/admin/avatar/' + user.id + '?v=' + user.avatar} alt="" />
  ) : (
    <>{initials(user.name)}</>
  )
}
function Heading({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string
  title: string
  sub: string
  children?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
      <div className="actions">{children}</div>
    </div>
  )
}
function Field({
  label,
  children,
}: {
  label: string
  children: ReactElement<{ id?: string }>
}) {
  const id = useId()
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  )
}

function OrderTable({
  orders,
  open,
  compact = false,
}: {
  orders: Order[]
  open: (id: string) => void
  compact?: boolean
}) {
  return (
    <div className="table-scroll" tabIndex={0} aria-label="Orders table">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            {!compact && <th>Date · IST</th>}
            <th>Channel</th>
            <th>Payment</th>
            <th>Fulfilment</th>
            <th className="align-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} onClick={() => open(o.id)}>
              <td>
                <button
                  className="order-link"
                  aria-label={'View order ' + o.receipt}
                  onClick={(e) => {
                    e.stopPropagation()
                    open(o.id)
                  }}
                >
                  <strong>#{o.receipt}</strong>
                </button>
              </td>
              <td>
                <div className="customer">
                  <span className="mini-avatar">
                    {initials(o.customer.name)}
                  </span>
                  <span>
                    {o.customer.name}
                    {!compact && (
                      <small className="member-contact">
                        {o.customer.city}
                      </small>
                    )}
                  </span>
                </div>
              </td>
              {!compact && <td className="muted">{date(o.created_at)}</td>}
              <td className="channel">{o.channel}</td>
              <td>
                <Badge value={o.status === 'paid' ? 'Paid' : 'Pending'} />
              </td>
              <td>
                <Badge value={o.fulfilment} />
              </td>
              <td className="align-right">{money(o.amount)}</td>
            </tr>
          ))}
          {!orders.length && (
            <tr>
              <td colSpan={7} className="empty">
                No orders match this view.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
function Revenue({ orders, days }: { orders: Order[]; days: number }) {
  const [now] = useState(Date.now)
  const today = Math.floor((now + 19800000) / 86400000)
  const buckets = Array.from({ length: days }, (_, i) => {
    const day = today - days + 1 + i
    const paid = orders.filter(
      (o) =>
        o.status === 'paid' &&
        Math.floor(
          (new Date(
            o.created_at.includes('T')
              ? o.created_at
              : o.created_at.replace(' ', 'T') + 'Z',
          ).getTime() +
            19800000) /
            86400000,
        ) === day,
    )
    return {
      website: paid
        .filter((o) => o.channel === 'Website')
        .reduce((n, o) => n + o.amount, 0),
      direct: paid
        .filter((o) => o.channel !== 'Website')
        .reduce((n, o) => n + o.amount, 0),
    }
  })
  const max = Math.max(...buckets.flatMap((b) => [b.website, b.direct]), 100)
  const curve = (key: 'website' | 'direct') => {
    const points = buckets.map((b, i) => ({
      x: 45 + (i * 610) / (days - 1),
      y: 170 - (b[key] / max) * 140,
    }))
    return points.reduce(
      (path, p, i) =>
        i === 0
          ? `M${p.x},${p.y}`
          : path +
            ` C${(p.x + points[i - 1].x) / 2},${points[i - 1].y} ${(p.x + points[i - 1].x) / 2},${p.y} ${p.x},${p.y}`,
      '',
    )
  }
  const website = curve('website'),
    direct = curve('direct'),
    axis = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      notation: 'compact',
      maximumFractionDigits: 0,
    })
  return (
    <div className="chart">
      <svg
        viewBox="0 0 700 200"
        role="img"
        aria-label={`Website and direct-channel paid orders in the last ${days} calendar days, Asia/Kolkata. ${money(buckets.reduce((n, b) => n + b.website + b.direct, 0))}`}
      >
        <defs>
          <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#704153" stopOpacity=".14" />
            <stop offset="1" stopColor="#704153" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 77, 124, 170].map((y, i) => (
          <g key={y}>
            <line
              x1="45"
              x2="655"
              y1={y}
              y2={y}
              stroke="#eee8df"
              strokeDasharray="3 4"
            />
            <text x="0" y={y + 3} fill="#a3988c" fontSize="9">
              {axis.format((max * (3 - i)) / 300)}
            </text>
          </g>
        ))}
        <path d={website + ' L655,170 L45,170 Z'} fill="url(#revenue-fill)" />
        <path d={website} fill="none" stroke="#704153" strokeWidth="2.3" />
        <path
          d={direct}
          fill="none"
          stroke="#c8ab80"
          strokeWidth="1.8"
          strokeDasharray="5 6"
        />
        <text x="45" y="195" fill="#a3988c" fontSize="9">
          {new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'short',
          }).format(new Date((today - days + 1) * 86400000 - 19800000))}
        </text>
        <text x="625" y="195" fill="#a3988c" fontSize="9">
          Today
        </text>
      </svg>
    </div>
  )
}

function Overview({
  data,
  days,
  setDays,
  go,
  open,
  preview,
}: {
  data: Snapshot
  days: number
  setDays: (n: number) => void
  go: (p: Page) => void
  open: (d: Drawer) => void
  preview: boolean
}) {
  const [now] = useState(Date.now)
  const start =
    Math.floor((now + 19800000) / 86400000) * 86400000 -
    19800000 -
    (days - 1) * 86400000
  const orders = data.orders.filter(
      (o) =>
        new Date(
          o.created_at.includes('T')
            ? o.created_at
            : o.created_at.replace(' ', 'T') + 'Z',
        ).getTime() >= start,
    ),
    paid = orders.filter((o) => o.status === 'paid'),
    total = paid.reduce((n, o) => n + o.amount, 0),
    low = data.products.flatMap((p) => p.variants).filter((v) => v.stock < 10),
    enquiries = data.enquiries.filter((e) => e.status !== 'Resolved')
  return (
    <>
      <Heading
        eyebrow={new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'full',
        }).format(new Date(now))}
        title="A good day to glow."
        sub="Here’s what’s happening in your studio today."
      >
        <Button icon="calendar" onClick={() => setDays(days === 7 ? 30 : 7)}>
          Last {days} days
        </Button>
        <Button primary icon="plus" onClick={() => open({ kind: 'new-order' })}>
          Create order
        </Button>
      </Heading>
      <div className="banner">
        <div>
          <span className="symbol">✦</span>
          <strong>A little attention goes a long way.</strong>
          <span> {low.length} variants are below 10 available units.</span>
        </div>
        <button className="text-link" onClick={() => go('inventory')}>
          Review inventory →
        </button>
      </div>
      <div className="stats">
        {[
          [
            'Gross receipts',
            money(total),
            'Paid orders created in this period',
            'trend',
          ],
          [
            'Orders received',
            String(orders.length),
            'All source channels',
            'orders',
          ],
          [
            'Average paid order',
            money(paid.length ? Math.round(total / paid.length) : 0),
            'Captured / recorded payments',
            'products',
          ],
          [
            'Open enquiries',
            String(enquiries.length),
            'Waiting for your attention',
            'enquiries',
          ],
        ].map(([label, value, note, icon]) => (
          <div className="card stat" key={label}>
            <div className="stat-label">
              {label}
              <Icon name={icon} />
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-foot">{note}</div>
          </div>
        ))}
      </div>
      <div className="grid-main">
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Revenue overview</h2>
              <div className="sub">
                Paid orders by creation date · Asia/Kolkata
              </div>
            </div>
            <div className="segmented">
              {[7, 30].map((n) => (
                <button
                  key={n}
                  className={days === n ? 'active' : ''}
                  onClick={() => setDays(n)}
                >
                  {n} days
                </button>
              ))}
            </div>
          </div>
          <Revenue orders={data.orders} days={days} />
          <div className="chart-bottom">
            <span>
              <i className="legend-dot" />
              Website checkout
            </span>
            <span><i className="legend-dot gold"/>Direct orders</span>
            <span>
              {preview
                ? 'Illustrative sample data'
                : 'Gross receipts · Refunds not deducted'}
            </span>
          </div>
        </section>
        <section className="card attention">
          <h2>Needs your attention</h2>
          {(
            [
              [
                'orders',
                'Orders to prepare',
                data.orders.filter((o) => o.fulfilment === 'Processing').length,
              ],
              ['inventory', 'Low-stock variants', low.length],
              [
                'enquiries',
                'New conversations',
                data.enquiries.filter((e) => e.status === 'New').length,
              ],
            ] as [Page, string, number][]
          ).map(([p, label, n]) => (
            <button className="task" key={p} onClick={() => go(p)}>
              <span className="task-icon">
                <Icon name={p} />
              </span>
              <span className="task-copy">
                <strong>{label}</strong>
                <small>{n} needing a little care</small>
              </span>
              <b>›</b>
            </button>
          ))}
          <div className="quiet-note">
            Small details. Beautiful experiences.
          </div>
        </section>
      </div>
      <section className="card table-card">
        <div className="table-top">
          <div>
            <h2>Recent orders</h2>
            <div className="sub">From your website and conversations.</div>
          </div>
          <button className="text-link" onClick={() => go('orders')}>
            View all orders →
          </button>
        </div>
        <OrderTable
          orders={data.orders.slice(0, 5)}
          compact
          open={(id) => open({ kind: 'order', id })}
        />
      </section>
      <div className="bottom-grid">
        <section className="card">
          <div className="card-header">
            <h2>Your candle collection</h2>
            <button className="text-link" onClick={() => go('products')}>
              View collection →
            </button>
          </div>
          <div className="products-small">
            {data.products.slice(0, 3).map((p) => (
              <div className="product-row" key={p.id}>
                <Art image={p.image} name={p.name} />
                <div className="details">
                  <strong>{p.name}</strong>
                  <small>
                    {p.variants.length} variant
                    {p.variants.length === 1 ? '' : 's'} · {p.stock} available
                  </small>
                </div>
                <div className="amount">{money(p.price)}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="card activity">
          <h2>Studio activity</h2>
          {data.activity.length ? (
            data.activity.slice(0, 4).map((a, i) => (
              <div className="activity-row" key={i}>
                <span className="activity-dot" />
                <div>
                  {a.action}
                  <small>
                    {a.detail} · {date(a.created_at)}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <p className="sub">
              Your team’s recorded actions will appear here.
            </p>
          )}
        </section>
      </div>
    </>
  )
}
function Login({
  preview,
  onLogin,
  setupToken,
  busy,
  error,
}: {
  preview: boolean
  onLogin: (email: string, password: string) => void
  setupToken: string | null
  busy: boolean
  error: string
}) {
  const [show, setShow] = useState(false),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [identifier, setIdentifier] = useState(''),
    [mismatch, setMismatch] = useState('')
  return (
    <section className="login-page" aria-label="Auraflare studio sign in">
      <div className="login-story">
        <div className="login-brand">
          Aura<em>flare</em>
        </div>
        <div className="eyebrow">The studio console</div>
        <div className="login-art">
          <div className="art">
            <StudioArt />
          </div>
        </div>
        <h2 className="login-quote">
          Behind every little light,
          <br />a little care.
        </h2>
        <p>
          A quiet space to tend to your collection, your customers, and
          everything in between.
        </p>
        <div className="login-story-footer">Hand poured. Heart felt.</div>
      </div>
      <div className="login-form-side">
        <div className="login-form-wrap">
          <div className="login-mark" aria-hidden="true">
            ✦
          </div>
          <div className="eyebrow">Welcome to the studio</div>
          <h1>
            {setupToken
              ? 'Your studio starts here.'
              : 'A little light starts here.'}
          </h1>
          <p className="sub">
            {setupToken
              ? 'Choose a password for your invited account.'
              : 'Sign in to your Auraflare workspace.'}
          </p>
          <form
            className="login-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (setupToken && password !== confirm) {
                setMismatch('The new passwords must match.')
                return
              }
              setMismatch('')
              onLogin(identifier, password)
            }}
          >
            {!setupToken && (
              <>
                <label htmlFor="admin-email">Email address</label>
                <input
                  id="admin-email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="Your email address"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={preview}
                  maxLength={254}
                />
              </>
            )}
            <label htmlFor="admin-password">
              {setupToken ? 'New password' : 'Password'}
            </label>
            <div className="password-field">
              <input
                id="admin-password"
                type={show ? 'text' : 'password'}
                name="password"
                autoComplete={setupToken ? 'new-password' : 'current-password'}
                placeholder="Your password"
                required
                minLength={setupToken ? 12 : 1}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={preview}
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                onClick={() => setShow((v) => !v)}
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
            {setupToken && (
              <>
                <label htmlFor="admin-confirm">Confirm new password</label>
                <input
                  id="admin-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </>
            )}
            {(error || mismatch) && (
              <p className="form-error" role="alert">
                {error || mismatch}
              </p>
            )}
            {preview ? (
              <Button primary onClick={() => onLogin('', '')}>
                Explore design preview →
              </Button>
            ) : (
              <button
                className="btn primary login-submit"
                disabled={busy}
                type="submit"
              >
                <span>
                  {busy
                    ? 'Please wait…'
                    : setupToken
                      ? 'Set password & sign in'
                      : 'Sign in'}
                </span>
                <span aria-hidden="true">→</span>
              </button>
            )}
          </form>
          <p className="login-disclosure">
            {preview
              ? 'Design preview · Sample records only. No credentials are accepted, and changes cannot be saved.'
              : setupToken
                ? 'Use at least 12 characters. This setup link works once.'
                : 'Secure studio access · Ask your studio owner for an invitation or a password recovery link.'}
          </p>
          <a className="text-link" href={website()}>
            ← Back to the candle studio
          </a>
        </div>
        <div className="login-bottom">
          Auraflare Studio · A little care in every detail.
        </div>
      </div>
    </section>
  )
}
function DrawerView({
  title,
  busy,
  close,
  children,
}: {
  title: string
  busy: boolean
  close: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<Element | null>(null)
  useEffect(() => {
    opener.current = document.activeElement
    const element = dialog.current
    element?.showModal()
    return () => {
      element?.close()
      if (opener.current instanceof HTMLElement && opener.current.isConnected)
        opener.current.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      className="drawer"
      ref={dialog}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) close()
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget || busy) return
        const b = e.currentTarget.getBoundingClientRect()
        if (
          e.clientX < b.left ||
          e.clientY < b.top ||
          e.clientX > b.right ||
          e.clientY > b.bottom
        )
          close()
      }}
    >
      <div className="drawer-head">
        <div>
          <div className="eyebrow">Auraflare studio</div>
          <h1>{title}</h1>
        </div>
        <button
          className="close"
          aria-label="Close panel"
          disabled={busy}
          onClick={close}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}

export default function AdminApp({ preview = false }: { preview?: boolean }) {
  const [data, setData] = useState<Snapshot | null>(null),
    [checking, setChecking] = useState(
      () =>
        !preview && !new URLSearchParams(location.hash.slice(1)).has('setup'),
    ),
    [page, setPage] = useState<Page>('overview'),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('All orders'),
    [collection, setCollection] = useState('All collections'),
    [days, setDays] = useState(7),
    [drawer, setDrawer] = useState<Drawer | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [navOpen, setNavOpen] = useState(false)
  const [setupToken, setSetupToken] = useState(() =>
    new URLSearchParams(location.hash.slice(1)).get('setup'),
  )
  const [mobile, setMobile] = useState(
    () => matchMedia('(max-width:650px)').matches,
  )
  const sidebar = useRef<HTMLElement>(null),
    menu = useRef<HTMLButtonElement>(null),
    main = useRef<HTMLElement>(null)
  useEffect(() => {
    if (setupToken) history.replaceState(null, '', location.pathname)
  }, [setupToken])
  useEffect(() => {
    const media = matchMedia('(max-width:650px)'),
      change = () => setMobile(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (preview || setupToken) return
    let cancelled = false
    ;(async () => {
      try {
        const session = await api<{ user: User | null; csrf?: string }>(
          '/session',
        )
        setCsrf(session.csrf || '')
        if (session.user) {
          const snapshot = await api<Snapshot>('/snapshot')
          if (!cancelled) setData(snapshot)
        }
      } catch (e) {
        if (!cancelled) setError(errorText(e))
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [preview, setupToken])
  useEffect(() => {
    if (!navOpen || !mobile) return
    sidebar.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = old
    }
  }, [navOpen, mobile])
  const refresh = async () => {
    if (!preview) {
      const snapshot = await api<Snapshot>('/snapshot')
      setData(snapshot)
      if (snapshot.user.role === 'staff' && ['content', 'team'].includes(page))
        setPage('overview')
    }
  }
  const save: Save = async (
    path,
    method,
    body,
    message = 'Saved to your studio.',
  ) => {
    if (preview) {
      setError(
        'This is a read-only design preview. Use the secure studio server to save changes.',
      )
      return
    }
    setBusy(true)
    setError('')
    try {
      await api(path, method, body)
      await refresh()
      setDrawer(null)
      setToast(message)
    } catch (e) {
      setError(errorText(e))
      if (e instanceof ApiError && e.status === 401) {
        setData(null)
        setCsrf('')
      }
    } finally {
      setBusy(false)
    }
  }
  const login = async (identifier: string, password: string) => {
    if (preview) {
      setData(previewSnapshot())
      return
    }
    setBusy(true)
    setError('')
    try {
      const session = await api<{ user: User; csrf: string }>(
        setupToken ? '/accept-invitation' : '/login',
        'POST',
        setupToken
          ? { token: setupToken, password }
          : { email: identifier, password },
      )
      setCsrf(session.csrf)
      setData(await api<Snapshot>('/snapshot'))
      setSetupToken(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  const logout = async () => {
    if (!preview)
      try {
        await api('/logout', 'POST', {})
      } catch (e) {
        setToast(errorText(e))
        return
      }
    setCsrf('')
    setData(null)
    setDrawer(null)
    setError('')
    setPage('overview')
  }
  const go = (p: Page) => {
    setPage(p)
    setQuery('')
    setFilter('All orders')
    setError('')
    setNavOpen(false)
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }))
    scrollTo(0, 0)
  }
  const open = (d: Drawer) => {
    setError('')
    setDrawer(d)
  }
  const exportOrders = (orders: Order[]) => {
    const cell = (value: string) =>
      '"' +
      (/^[=+\-@\t\r]/.test(value) ? "'" : '') +
      value.replaceAll('"', '""') +
      '"'
    const rows = [
      [
        'Order',
        'Customer',
        'Date (Asia/Kolkata)',
        'Channel',
        'Payment',
        'Fulfilment',
        'Total INR',
      ],
      ...orders.map((o) => [
        o.receipt,
        o.customer.name,
        date(o.created_at),
        o.channel,
        o.status,
        o.fulfilment,
        (o.amount / 100).toFixed(2),
      ]),
    ]
    const blob = new Blob(
      ['\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n')],
      { type: 'text/csv;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = url
    a.download = 'auraflare-orders.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (checking)
    return (
      <div className="admin-app">
        <div className="loading-studio" role="status">
          Opening your studio…
        </div>
      </div>
    )
  if (!data)
    return (
      <div className="admin-app">
        <Login
          preview={preview}
          onLogin={login}
          setupToken={setupToken}
          busy={busy}
          error={error}
        />
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    )
  const owner = data.user.role === 'owner',
    filteredOrders = data.orders.filter(
      (o) =>
        (filter === 'All orders' ||
          o.fulfilment === filter ||
          o.channel === filter) &&
        [o.receipt, o.customer.name, o.customer.email, o.channel]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
  const filteredProducts = data.products.filter(
    (p) =>
      (collection === 'All collections' || p.collection === collection) &&
      [p.name, p.note, p.collection, ...p.variants.map((v) => v.sku)]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const product = drawer?.id
      ? data.products.find((p) => p.id === drawer.id)
      : undefined,
    order = drawer?.id
      ? data.orders.find((o) => o.id === drawer.id)
      : undefined,
    enquiry = drawer?.id
      ? data.enquiries.find((e) => e.id === drawer.id)
      : undefined,
    member = drawer?.id ? data.team.find((u) => u.id === drawer.id) : undefined
  return (
    <div className="admin-app">
      {navOpen && mobile && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          tabIndex={-1}
          onClick={() => {
            setNavOpen(false)
            requestAnimationFrame(() =>
              menu.current?.focus({ preventScroll: true }),
            )
          }}
        />
      )}
      <aside
        ref={sidebar}
        className={'sidebar' + (navOpen ? ' open' : '')}
        inert={mobile && !navOpen}
        aria-label="Studio navigation"
        onKeyDown={(e) => {
          if (!mobile || !navOpen) return
          if (e.key === 'Escape') {
            setNavOpen(false)
            requestAnimationFrame(() =>
              menu.current?.focus({ preventScroll: true }),
            )
          }
          if (e.key === 'Tab') {
            const buttons = [
              ...sidebar.current!.querySelectorAll<HTMLButtonElement>(
                'button:not(:disabled)',
              ),
            ]
            if (e.shiftKey && document.activeElement === buttons[0]) {
              e.preventDefault()
              buttons.at(-1)?.focus()
            } else if (
              !e.shiftKey &&
              document.activeElement === buttons.at(-1)
            ) {
              e.preventDefault()
              buttons[0].focus()
            }
          }
        }}
      >
        <div className="brand">
          Aura<em>flare</em>
          <small>THE STUDIO CONSOLE</small>
        </div>
        <button
          className="mobile-close"
          onClick={() => {
            setNavOpen(false)
            requestAnimationFrame(() =>
              menu.current?.focus({ preventScroll: true }),
            )
          }}
          aria-label="Close navigation"
        >
          ×
        </button>
        <div className="nav-label">Workspace</div>
        <nav className="nav">
          {Object.entries(pages)
            .filter(([key]) => owner || !['content', 'team'].includes(key))
            .map(([key, label]) => (
              <button
                key={key}
                className={page === key ? 'active' : ''}
                aria-current={page === key ? 'page' : undefined}
                aria-label={label}
                onClick={() => go(key as Page)}
              >
                <Icon name={key} />
                {label}
                {key === 'orders' && (
                  <span className="count">
                    {
                      data.orders.filter((o) => o.fulfilment === 'Processing')
                        .length
                    }
                  </span>
                )}
                {key === 'enquiries' && (
                  <span className="count">
                    {data.enquiries.filter((e) => e.status === 'New').length}
                  </span>
                )}
              </button>
            ))}
        </nav>
        <div className="side-bottom">
          <div className="studio">
            <span className="dot" />
            {preview ? 'Design review workspace' : 'Your studio, at a glance'}
            <br />
            <span>A little care in every detail.</span>
          </div>
          <div className="profile">
            <button
              className="profile-entry"
              aria-label="Open my profile"
              onClick={() => go('profile')}
            >
              <div className="avatar">
                <Avatar user={data.user} />
              </div>
              <div>
                <strong className="profile-name">{data.user.name}</strong>
                <span>{owner ? 'Studio owner' : 'Fulfilment staff'}</span>
              </div>
            </button>
            <button className="sign-out" aria-label="Sign out" onClick={logout}>
              ↪
            </button>
          </div>
        </div>
      </aside>
      <div className="main" inert={mobile && navOpen}>
        <header className="topbar">
          <button
            ref={menu}
            className="mobile-menu"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            ☰
          </button>
          <div className="crumb">
            Workspace <span> / </span>
            <strong>{pages[page]}</strong>
          </div>
          <div className="top-actions">
            <label className="searchbox">
              <Icon name="search" />
              <input
                aria-label="Search orders or products"
                placeholder="Search orders or products…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (!['orders', 'products'].includes(page)) setPage('orders')
                }}
              />
              <span className="key">↵</span>
            </label>
            <span className="pill">
              {preview ? 'Design preview' : 'Studio admin'}
            </span>
            <span className="vertical" />
            <button
              className="icon-button"
              aria-label="View notifications"
              onClick={() => open({ kind: 'notifications' })}
            >
              <Icon name="bell" />
              <span className="notification-dot" />
            </button>
            <span className="vertical" />
            <span className="signed-email">{data.user.email}</span>
            <button
              className="avatar"
              aria-label="Open my profile"
              onClick={() => go('profile')}
            >
              <Avatar user={data.user} />
            </button>
          </div>
        </header>
        <main className="page" ref={main} tabIndex={-1} id="admin-main">
          {preview && (
            <div className="preview-banner" role="note">
              <strong>Interactive design preview</strong> · Sample records only.
              Changes, uploads and invitations are disabled.{' '}
              <a href="admin.html">Secure sign-in</a>
            </div>
          )}
          {!owner && (
            <div className="role-note">
              Fulfilment workspace · Manage orders, enquiries and stock.
              Pricing, publishing and team access are owner-only.
            </div>
          )}
          {error && !drawer && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {page === 'overview' && (
            <Overview
              data={data}
              days={days}
              setDays={setDays}
              go={go}
              open={open}
              preview={preview}
            />
          )}
          {page === 'orders' && (
            <>
              <Heading
                eyebrow="Every little order matters"
                title="Orders, with care."
                sub="Website checkout, WhatsApp, Instagram and direct orders."
              >
                <Button
                  icon="download"
                  onClick={() => exportOrders(filteredOrders)}
                >
                  Export CSV
                </Button>
                <Button
                  primary
                  icon="plus"
                  onClick={() => open({ kind: 'new-order' })}
                >
                  Create order
                </Button>
              </Heading>
              <div className="card table-card">
                <div className="toolbar">
                  <input
                    aria-label="Search orders"
                    placeholder="Search name, email or order…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    aria-label="Filter orders"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {[
                      'All orders',
                      'Awaiting payment',
                      'Processing',
                      'Shipped',
                      'Delivered',
                      'Cancelled',
                      'Website',
                      'WhatsApp',
                      'Instagram',
                      'Phone',
                      'In person',
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <span className="sub">{filteredOrders.length} orders</span>
                </div>
                <OrderTable
                  orders={filteredOrders}
                  open={(id) => open({ kind: 'order', id })}
                />
                <div className="table-footer">
                  <span>{filteredOrders.length} matching records</span>
                  <span>All amounts in INR · Asia/Kolkata</span>
                </div>
              </div>
            </>
          )}
          {page === 'products' && (
            <>
              <Heading
                eyebrow="Your candle collection"
                title="Made to be loved."
                sub="Tend to every scent, shape and little detail."
              >
                {owner && (
                  <Button
                    primary
                    icon="plus"
                    onClick={() => open({ kind: 'product' })}
                  >
                    Add product
                  </Button>
                )}
              </Heading>
              <div className="tabs">
                {[
                  'All collections',
                  ...new Set(data.products.map((p) => p.collection)),
                ].map((c) => (
                  <button
                    key={c}
                    className={collection === c ? 'active' : ''}
                    onClick={() => setCollection(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="toolbar catalogue-search">
                <input
                  aria-label="Search products"
                  placeholder="Search products or SKU…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="catalogue">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    className="card product-card"
                    onClick={() => open({ kind: 'product', id: p.id })}
                  >
                    <Art image={p.image} name={p.name} />
                    <div className="product-info">
                      <span className="pill">{p.collection}</span>
                      <h2>{p.name}</h2>
                      <div className="sub">{p.note}</div>
                      <div className="product-meta">
                        <strong>{money(p.price)}</strong>
                        <span className="sub">{p.stock} available</span>
                        <Badge value={p.status} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {!filteredProducts.length && (
                <div className="card empty">No products match this view.</div>
              )}
            </>
          )}
          {page === 'inventory' && (
            <>
              <Heading
                eyebrow="A little room for more"
                title="Stock & little details."
                sub="Available quantities exclude reserved orders. Every adjustment keeps its reason."
              />
              <div className="card table-card">
                <div className="toolbar">
                  <input
                    placeholder="Search variants or SKU…"
                    aria-label="Search inventory"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    aria-label="Filter inventory"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {['All orders', 'Low stock', 'Out of stock'].map((s) => (
                      <option key={s} value={s}>
                        {s === 'All orders' ? 'All stock' : s}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  aria-label="Inventory table"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Product / variant</th>
                        <th>SKU</th>
                        <th>Available</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.products
                        .flatMap((p) => p.variants.map((v) => ({ p, v })))
                        .filter(
                          ({ p, v }) =>
                            [p.name, v.name, v.sku]
                              .join(' ')
                              .toLowerCase()
                              .includes(query.toLowerCase()) &&
                            (filter === 'All orders' ||
                              (filter === 'Low stock' && v.stock < 10) ||
                              (filter === 'Out of stock' && v.stock === 0)),
                        )
                        .map(({ p, v }) => (
                          <tr key={v.id}>
                            <td>
                              {p.name}
                              <small className="member-contact">{v.name}</small>
                            </td>
                            <td className="muted">{v.sku}</td>
                            <td className="inventory-number">{v.stock}</td>
                            <td>
                              <Badge
                                value={
                                  v.stock === 0
                                    ? 'Out of stock'
                                    : v.stock < 10
                                      ? 'Low stock'
                                      : 'In stock'
                                }
                              />
                            </td>
                            <td>
                              <Button
                                onClick={() =>
                                  open({ kind: 'stock', id: v.id })
                                }
                              >
                                Adjust stock
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <section className="card history">
                <h2>Adjustment history</h2>
                {data.movements.length ? (
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    aria-label="Stock movement history"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Change</th>
                          <th>Available after</th>
                          <th>Reason</th>
                          <th>Date · IST</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.movements.map((m) => (
                          <tr key={m.id}>
                            <td>{m.sku}</td>
                            <td>
                              {m.delta > 0 ? '+' : ''}
                              {m.delta}
                            </td>
                            <td>{m.stock_after}</td>
                            <td className="wrap-cell">{m.reason}</td>
                            <td>{date(m.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="sub">No recorded stock movements yet.</p>
                )}
              </section>
            </>
          )}
          {page === 'enquiries' && (
            <>
              <Heading
                eyebrow="Conversations worth keeping"
                title="A little hello."
                sub="Internal follow-ups for your website, gifting and direct channels."
              >
                <Button
                  primary
                  icon="plus"
                  onClick={() => open({ kind: 'new-enquiry' })}
                >
                  Add enquiry
                </Button>
              </Heading>
              <div className="card table-card">
                <div className="toolbar">
                  <input
                    aria-label="Search enquiries"
                    placeholder="Search enquiries…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    aria-label="Filter enquiries"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {['All orders', 'New', 'In progress', 'Resolved'].map(
                      (v) => (
                        <option key={v} value={v}>
                          {v === 'All orders' ? 'All enquiries' : v}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  aria-label="Enquiries table"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Contact</th>
                        <th>Conversation</th>
                        <th>Channel</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.enquiries
                        .filter(
                          (e) =>
                            [e.name, e.subject]
                              .join(' ')
                              .toLowerCase()
                              .includes(query.toLowerCase()) &&
                            (filter === 'All orders' || filter === e.status),
                        )
                        .map((e) => (
                          <tr key={e.id}>
                            <td>{e.name}</td>
                            <td>{e.subject}</td>
                            <td>{e.channel}</td>
                            <td>
                              <Badge value={e.status} />
                            </td>
                            <td>
                              <Button
                                onClick={() =>
                                  open({ kind: 'enquiry', id: e.id })
                                }
                              >
                                View enquiry
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!data.enquiries.length && (
                  <p className="empty">
                    No enquiries recorded. Add a conversation when it comes in.
                  </p>
                )}
              </div>
            </>
          )}
          {page === 'content' && owner && data.content && (
            <ContentPage
              key={data.content.updated_at}
              content={data.content.draft}
              save={save}
              preview={preview}
              busy={busy}
            />
          )}
          {page === 'team' && owner && (
            <>
              <Heading
                eyebrow="A shared little purpose"
                title="The people behind the glow."
                sub="Owner-managed accounts, invitations and workspace permissions."
              >
                <Button
                  primary
                  icon="plus"
                  onClick={() => open({ kind: 'invite' })}
                >
                  Add user
                </Button>
              </Heading>
              <div className="card table-card">
                <div
                  className="table-scroll"
                  tabIndex={0}
                  aria-label="Team members"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Team member</th>
                        <th>Role</th>
                        <th>Access</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.team.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className="customer">
                              <span className="mini-avatar">
                                {initials(u.name)}
                              </span>
                              <div>
                                {u.name}
                                <small className="member-contact">
                                  {u.email}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {u.role === 'owner'
                              ? 'Studio owner'
                              : 'Fulfilment staff'}
                          </td>
                          <td>
                            <Badge
                              value={
                                !u.active
                                  ? 'Inactive'
                                  : u.invited
                                    ? 'Invitation pending'
                                    : 'Active'
                              }
                            />
                          </td>
                          <td>
                            <Button
                              onClick={() => open({ kind: 'member', id: u.id })}
                            >
                              Manage access
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="permission">
                Owners manage products, pricing, publishing and accounts.
                Fulfilment staff manage orders, stock, enquiries and their own
                profile. Permissions are enforced by the server.
              </p>
            </>
          )}
          {page === 'profile' && (
            <ProfilePage
              user={data.user}
              save={save}
              refresh={refresh}
              preview={preview}
              busy={busy}
              changedPassword={() => {
                setData(null)
                setCsrf('')
                setToast('Password updated. Sign in again.')
              }}
            />
          )}
          <footer className="page-note">
            <span>AURAFLARE STUDIO · Made for the moments in between.</span>
            <span>
              {preview
                ? 'Interactive prototype · Sample data · Read-only'
                : 'Studio records · Asia/Kolkata'}
            </span>
          </footer>
        </main>
      </div>
      {drawer && (
        <DrawerView
          key={drawer.kind + '-' + (drawer.id || 'new')}
          title={
            drawer.kind === 'order'
              ? 'Order #' + order?.receipt
              : drawer.kind === 'new-order'
                ? 'A new little order.'
                : drawer.kind === 'product'
                  ? product
                    ? 'Product details.'
                    : 'A new little light.'
                  : drawer.kind === 'stock'
                    ? 'A little stock adjustment.'
                    : drawer.kind === 'enquiry'
                      ? 'A little conversation.'
                      : drawer.kind === 'new-enquiry'
                        ? 'A new hello.'
                        : drawer.kind === 'member'
                          ? 'Team member.'
                          : drawer.kind === 'invite'
                            ? 'Welcome someone in.'
                            : drawer.kind === 'invitation'
                              ? 'Review invitation.'
                              : 'Needs your attention'
          }
          busy={busy}
          close={() => {
            setDrawer(null)
            setError('')
          }}
        >
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {drawer.kind === 'order' && order && (
            <OrderPanel
              order={order}
              save={save}
              owner={owner}
              disabled={preview || busy}
            />
          )}
          {drawer.kind === 'new-order' && (
            <NewOrder data={data} save={save} disabled={preview || busy} />
          )}
          {drawer.kind === 'product' && (
            <ProductForm
              product={product}
              save={save}
              disabled={preview || busy || !owner}
              owner={owner}
              uploadError={setError}
            />
          )}
          {drawer.kind === 'stock' && (
            <StockForm
              data={data}
              variantId={drawer.id!}
              save={save}
              disabled={preview || busy}
            />
          )}
          {['enquiry', 'new-enquiry'].includes(drawer.kind) && (
            <EnquiryForm
              enquiry={enquiry}
              data={data}
              save={save}
              disabled={preview || busy}
            />
          )}
          {['invite', 'member'].includes(drawer.kind) && (
            <MemberForm
              member={member}
              disabled={preview || busy}
              save={save}
              invite={async (body, purposeId) => {
                setBusy(true)
                setError('')
                try {
                  if (preview)
                    throw new Error(
                      'Invitations are disabled in the design preview.',
                    )
                  const result = await api<{ preview: Invitation }>(
                    purposeId ? '/team/' + purposeId + '/invitation' : '/team',
                    'POST',
                    body,
                  )
                  await refresh()
                  setDrawer({ kind: 'invitation', invitation: result.preview })
                } catch (e) {
                  setError(errorText(e))
                } finally {
                  setBusy(false)
                }
              }}
            />
          )}
          {drawer.kind === 'invitation' && drawer.invitation && (
            <div className="invitation-preview">
              <p className="role-note">
                Private email preview · No message has been sent.
              </p>
              <p>
                <strong>To:</strong> {drawer.invitation.to}
              </p>
              <h2>{drawer.invitation.subject}</h2>
              <pre>{drawer.invitation.message}</pre>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(drawer.invitation!.url).then(
                    () => setToast('Private setup link copied.'),
                    () =>
                      setError('Copy the setup link from the preview text.'),
                  )
                }}
              >
                Copy private setup link
              </Button>
            </div>
          )}
          {drawer.kind === 'notifications' && (
            <>
              <p className="sub">
                Actionable updates from your current records.
              </p>
              <button
                className="task"
                onClick={() => {
                  setDrawer(null)
                  go('inventory')
                }}
              >
                <span className="task-icon">
                  <Icon name="inventory" />
                </span>
                <span className="task-copy">
                  <strong>Review inventory</strong>
                  <small>
                    {
                      data.products
                        .flatMap((p) => p.variants)
                        .filter((v) => v.stock < 10).length
                    }{' '}
                    variants below 10 units
                  </small>
                </span>
                →
              </button>
              <button
                className="task"
                onClick={() => {
                  setDrawer(null)
                  go('enquiries')
                }}
              >
                <span className="task-icon">
                  <Icon name="enquiries" />
                </span>
                <span className="task-copy">
                  <strong>New conversations</strong>
                  <small>
                    {data.enquiries.filter((e) => e.status === 'New').length}{' '}
                    awaiting attention
                  </small>
                </span>
                →
              </button>
            </>
          )}
        </DrawerView>
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  )
}

function ContentPage({
  content,
  save,
  preview,
  busy,
}: {
  content: Content
  save: Save
  preview: boolean
  busy: boolean
}) {
  const [draft, setDraft] = useState(content),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState('')
  const edit = (key: keyof Content, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }))
  const upload = async (file?: File) => {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const result = await api<{ url: string }>('/upload', 'POST', {
        kind: 'banner',
        image: await imageData(file, 5),
      })
      edit('image', result.url)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setUploading(false)
    }
  }
  return (
    <>
      <Heading
        eyebrow="The window to your studio"
        title="A little world of your own."
        sub="Preview your hero copy, save a draft, then publish when it’s ready."
      >
        <a className="btn" href={website()} target="_blank" rel="noreferrer">
          View website ↗
        </a>
      </Heading>
      <div className="content-grid">
        <section className="card settings">
          <div className="eyebrow">Live copy preview</div>
          <div className="hero-preview">
            <div>
              <div className="eyebrow">For the beauty of everyday</div>
              <h2>{draft.headline}</h2>
              <p>{draft.subtitle}</p>
              <span className="preview-cta">{draft.button} ↗</span>
            </div>
            <Art image={draft.image} />
          </div>
          <p className="sub preview-caption">
            The preview grows with your copy, including on smaller screens.
          </p>
          <h2>A little announcement</h2>
          <div className="announcement-preview">
            {draft.announcement || 'No announcement'}
          </div>
          <h2>Campaign image</h2>
          <p className="sub">
            JPEG, PNG or WebP · Up to 5 MB. Images are validated and re-encoded
            by the server.
          </p>
          <label className="upload-label">
            Choose campaign image
            <input
              aria-label="Campaign image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={preview || busy || uploading}
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <form
          className="card settings form"
          onSubmit={(e) => {
            e.preventDefault()
            save(
              '/content',
              'PUT',
              { ...draft, publish: true },
              'Website content published.',
            )
          }}
        >
          <h2>The little details</h2>
          <Field label="Hero headline">
            <textarea
              className="field"
              required
              maxLength={240}
              value={draft.headline}
              onChange={(e) => edit('headline', e.target.value)}
              rows={3}
            />
          </Field>
          <Field label="Hero subtitle">
            <textarea
              className="field"
              required
              maxLength={800}
              value={draft.subtitle}
              onChange={(e) => edit('subtitle', e.target.value)}
              rows={4}
            />
          </Field>
          <Field label="Button label">
            <input
              className="field"
              required
              maxLength={80}
              value={draft.button}
              onChange={(e) => edit('button', e.target.value)}
            />
          </Field>
          <Field label="Announcement text">
            <textarea
              className="field"
              maxLength={200}
              value={draft.announcement}
              onChange={(e) => edit('announcement', e.target.value)}
              rows={2}
            />
          </Field>
          <Field label="Featured collection">
            <select
              className="field"
              value={draft.featured}
              onChange={(e) => edit('featured', e.target.value)}
            >
              {['All', 'Home', 'Gifting', 'Sculptural'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <p className="permission">
            A draft stays in the studio. Publishing updates the website served
            by this Node application. Static design reviews do not consume live
            catalogue or content changes.
          </p>
          <div className="drawer-footer">
            <Button
              disabled={preview || busy || uploading}
              onClick={() =>
                save(
                  '/content',
                  'PUT',
                  { ...draft, publish: false },
                  'Content draft saved. The public website is unchanged.',
                )
              }
            >
              Save draft
            </Button>
            <Button
              type="submit"
              primary
              disabled={preview || busy || uploading}
            >
              Publish changes
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
function ProductForm({
  product,
  save,
  disabled,
  owner,
  uploadError,
}: {
  product?: Product
  save: Save
  disabled: boolean
  owner: boolean
  uploadError: (s: string) => void
}) {
  const [form, setForm] = useState({
    name: product?.name || '',
    collection: product?.collection || 'The Candle Edit',
    note: product?.note || '',
    description: product?.description || '',
    category: product?.category || ['Home'],
    image: product?.image || '',
    status: product?.status || 'Draft',
    reason: '',
  })
  const [variants, setVariants] = useState<
      (Omit<Variant, 'id'> & { id?: string })[]
    >(product?.variants || [{ sku: '', name: 'Standard', price: 0, stock: 0 }]),
    [uploading, setUploading] = useState(false)
  const variant = (index: number, changes: Partial<Variant>) =>
    setVariants((vs) =>
      vs.map((v, i) => (i === index ? { ...v, ...changes } : v)),
    )
  const upload = async (file?: File) => {
    if (!file) return
    setUploading(true)
    uploadError('')
    try {
      const r = await api<{ url: string }>('/upload', 'POST', {
        kind: 'product',
        image: await imageData(file, 5),
      })
      setForm((f) => ({ ...f, image: r.url }))
    } catch (e) {
      uploadError(errorText(e))
    } finally {
      setUploading(false)
    }
  }
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        save(
          product ? '/products/' + product.id : '/products',
          product ? 'PUT' : 'POST',
          { ...form, variants },
          product
            ? 'Product details updated.'
            : 'Product added to your studio.',
        )
      }}
    >
      {!owner && (
        <p className="role-note">
          Product details are read-only for fulfilment staff.
        </p>
      )}
      <fieldset disabled={disabled || uploading}>
        <Field label="Product name">
          <input
            className="field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={120}
          />
        </Field>
        <Field label="Collection">
          <input
            className="field"
            required
            value={form.collection}
            onChange={(e) => setForm({ ...form, collection: e.target.value })}
            maxLength={80}
          />
        </Field>
        <Field label="Scent / style notes">
          <input
            className="field"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            maxLength={200}
          />
        </Field>
        <Field label="Description">
          <textarea
            className="field"
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={3000}
          />
        </Field>
        <div className="category-picks">
          <span>Storefront categories</span>
          {['Home', 'Gifting', 'Sculptural'].map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                className="check"
                checked={form.category.includes(c)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.checked
                      ? [...form.category, c]
                      : form.category.filter((x) => x !== c),
                  })
                }
              />
              {c}
            </label>
          ))}
        </div>
        <Field label="Product state">
          <select
            className="field"
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as Product['status'] })
            }
          >
            <option>Draft</option>
            <option>Active</option>
          </select>
        </Field>
        {form.image && (
          <div className="product-form-image">
            <img src={form.image} alt={form.name || 'Product preview'} />
          </div>
        )}
        <Field label="Product photo · PNG, JPEG or WebP, up to 5 MB">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </Field>
        <h2 className="section-label">Variants & available stock</h2>
        {variants.map((v, i) => (
          <div className="variant-editor" key={v.id || 'new-' + i}>
            <Field label={'Variant ' + (i + 1) + ' name / colour / size'}>
              <input
                className="field"
                required
                maxLength={120}
                value={v.name}
                onChange={(e) => variant(i, { name: e.target.value })}
              />
            </Field>
            <Field label="SKU">
              <input
                className="field"
                required
                maxLength={60}
                value={v.sku}
                onChange={(e) => variant(i, { sku: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Price · INR">
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1000000"
                  required
                  value={v.price / 100}
                  onChange={(e) =>
                    variant(i, {
                      price: Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
              </Field>
              <Field label="Available quantity">
                <input
                  className="field"
                  type="number"
                  min="0"
                  max="1000000"
                  required
                  value={v.stock}
                  onChange={(e) =>
                    variant(i, { stock: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            {variants.length > 1 && (
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  setVariants((vs) => vs.filter((_, index) => i !== index))
                }
              >
                Remove variant from sale
              </button>
            )}
          </div>
        ))}
        <Button
          icon="plus"
          disabled={variants.length >= 30}
          onClick={() =>
            setVariants((vs) => [
              ...vs,
              { name: '', sku: '', price: 0, stock: 0 },
            ])
          }
        >
          Add variant
        </Button>
        <Field label="Reason for existing stock changes">
          <input
            className="field"
            minLength={3}
            maxLength={300}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Required when an existing quantity changes"
          />
        </Field>
      </fieldset>
      <div className="drawer-footer">
        <Button type="submit" primary disabled={disabled || uploading}>
          {uploading
            ? 'Processing photo…'
            : product
              ? 'Save product'
              : 'Create product'}
        </Button>
      </div>
    </form>
  )
}
function StockForm({
  data,
  variantId,
  save,
  disabled,
}: {
  data: Snapshot
  variantId: string
  save: Save
  disabled: boolean
}) {
  const variant = data.products
      .flatMap((p) => p.variants)
      .find((v) => v.id === variantId),
    [delta, setDelta] = useState(0),
    [reason, setReason] = useState('')
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        save(
          '/inventory',
          'POST',
          { variantId, delta, reason },
          'Stock adjusted. The movement has been recorded.',
        )
      }}
    >
      <div className="detail-block">
        <strong>{variant?.name}</strong>
        <p className="sub">{variant?.sku}</p>
        <div className="detail-line">
          <span>Currently available</span>
          <strong>{variant?.stock}</strong>
        </div>
        <div className="detail-line">
          <span>After adjustment</span>
          <strong>{(variant?.stock || 0) + delta}</strong>
        </div>
      </div>
      <Field label="Change in quantity · use a negative number to remove stock">
        <input
          className="field"
          type="number"
          required
          min={-(variant?.stock || 0)}
          max="1000000"
          value={delta}
          onChange={(e) => setDelta(Number(e.target.value))}
        />
      </Field>
      <Field label="Adjustment reason">
        <textarea
          className="field"
          required
          minLength={3}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="For example, a new batch or damaged stock"
        />
      </Field>
      <div className="drawer-footer">
        <Button primary type="submit" disabled={disabled || delta === 0}>
          Save adjustment
        </Button>
      </div>
    </form>
  )
}
function OrderPanel({
  order,
  save,
  owner,
  disabled,
}: {
  order: Order
  save: Save
  owner: boolean
  disabled: boolean
}) {
  const [form, setForm] = useState({
      fulfilment: order.fulfilment,
      tracking: order.tracking,
      carrier: order.carrier,
      note: order.note,
    }),
    [receipt, setReceipt] = useState('')
  const transitions: Record<string, string[]> = {
    'Awaiting payment': ['Processing', 'Cancelled'],
    Processing: ['Shipped', 'Cancelled'],
    Shipped: ['Delivered'],
    Delivered: [],
    Cancelled: [],
  }
  return (
    <>
      <div className="detail-block">
        <div className="detail-line">
          <span>Customer</span>
          <strong>{order.customer.name}</strong>
        </div>
        <p className="sub">
          {order.customer.email}
          <br />
          {order.customer.phone}
          <br />
          {order.customer.address} {order.customer.city}
        </p>
        <div className="detail-line">
          <span>Source channel</span>
          <strong>{order.channel}</strong>
        </div>
        <div className="detail-line">
          <span>Payment</span>
          <Badge value={order.status === 'paid' ? 'Paid' : 'Pending'} />
        </div>
        {order.manual_reference && (
          <p className="sub">Manual receipt: {order.manual_reference}</p>
        )}
        {order.items.map((item, i) => (
          <div className="detail-line" key={i}>
            <span>
              {item.name}
              {item.variant ? ' · ' + item.variant : ''} × {item.quantity}
            </span>
            <strong>{money(item.unitPrice * item.quantity)}</strong>
          </div>
        ))}
        <div className="detail-line">
          <strong>Total</strong>
          <strong>{money(order.amount)}</strong>
        </div>
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          save(
            '/orders/' + order.id,
            'PATCH',
            form,
            'Order record updated. No carrier booking or customer message was sent.',
          )
        }}
      >
        <Field label="Fulfilment status">
          <select
            className="field"
            value={form.fulfilment}
            onChange={(e) => setForm({ ...form, fulfilment: e.target.value })}
          >
            {[
              'Awaiting payment',
              'Processing',
              'Shipped',
              'Delivered',
              'Cancelled',
            ].map((v) => (
              <option
                key={v}
                disabled={
                  v !== order.fulfilment &&
                  !transitions[order.fulfilment]?.includes(v)
                }
              >
                {v}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Carrier">
            <input
              className="field"
              maxLength={100}
              value={form.carrier}
              onChange={(e) => setForm({ ...form, carrier: e.target.value })}
            />
          </Field>
          <Field label="Tracking reference">
            <input
              className="field"
              maxLength={200}
              value={form.tracking}
              onChange={(e) => setForm({ ...form, tracking: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Internal order note">
          <textarea
            className="field"
            maxLength={2000}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </Field>
        <p className="permission">
          Shipment is a record of a dispatch you have arranged. This action does
          not book a courier. Cancelling releases reserved stock; refunds must
          be handled through the payment provider.
        </p>
        <div className="drawer-footer">
          <Button primary type="submit" disabled={disabled}>
            Save order
          </Button>
        </div>
      </form>
      {owner &&
        order.channel !== 'Website' &&
        order.status !== 'paid' &&
        order.fulfilment !== 'Cancelled' && (
          <form
            className="form receipt-form"
            onSubmit={(e) => {
              e.preventDefault()
              save(
                '/orders/' + order.id + '/payment',
                'POST',
                { reference: receipt, amount: order.amount },
                'Direct payment receipt recorded.',
              )
            }}
          >
            <h2>Record a received payment</h2>
            <p className="permission">
              Only record cash or a bank transfer you have already received for{' '}
              {money(order.amount)}. This is a manual ledger record, not a
              gateway confirmation.
            </p>
            <Field label="Cash / bank receipt reference">
              <input
                className="field"
                required
                minLength={4}
                maxLength={200}
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={disabled}>
              Record received payment
            </Button>
          </form>
        )}
      {order.channel === 'Website' && (
        <p className="permission">
          Website payments are confirmed only by verified Razorpay callbacks.
        </p>
      )}
    </>
  )
}
function NewOrder({
  data,
  save,
  disabled,
}: {
  data: Snapshot
  save: Save
  disabled: boolean
}) {
  const active = data.products
      .filter((p) => p.status === 'Active')
      .flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name }))),
    [items, setItems] = useState([{ id: active[0]?.id || '', quantity: 1 }]),
    [channel, setChannel] = useState('WhatsApp'),
    [customer, setCustomer] = useState({
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
    }),
    [note, setNote] = useState(''),
    requestId = useRef(crypto.randomUUID())
  const total = items.reduce(
    (n, i) => n + (active.find((v) => v.id === i.id)?.price || 0) * i.quantity,
    0,
  )
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        save(
          '/orders',
          'POST',
          { items, channel, customer, note, requestId: requestId.current },
          'Direct order created. Available stock has been reserved.',
        )
      }}
    >
      <Field label="Source channel">
        <select
          className="field"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          {['WhatsApp', 'Instagram', 'Phone', 'In person'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </Field>
      <Field label="Customer name">
        <input
          className="field"
          required
          maxLength={100}
          value={customer.name}
          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
        />
      </Field>
      <div className="form-grid">
        <Field label="Email · optional">
          <input
            className="field"
            type="email"
            maxLength={254}
            value={customer.email}
            onChange={(e) =>
              setCustomer({ ...customer, email: e.target.value })
            }
          />
        </Field>
        <Field label="Phone · optional">
          <input
            className="field"
            type="tel"
            maxLength={30}
            value={customer.phone}
            onChange={(e) =>
              setCustomer({ ...customer, phone: e.target.value })
            }
          />
        </Field>
      </div>
      <Field label="Delivery address">
        <textarea
          className="field"
          maxLength={500}
          value={customer.address}
          onChange={(e) =>
            setCustomer({ ...customer, address: e.target.value })
          }
        />
      </Field>
      <Field label="City">
        <input
          className="field"
          maxLength={100}
          value={customer.city}
          onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
        />
      </Field>
      <h2 className="section-label">A little collection</h2>
      {items.map((item, i) => (
        <div className="order-line-editor" key={i}>
          <Field label={'Item ' + (i + 1)}>
            <select
              className="field"
              required
              value={item.id}
              onChange={(e) =>
                setItems(
                  items.map((v, j) =>
                    i === j ? { ...v, id: e.target.value } : v,
                  ),
                )
              }
            >
              {active.map((v) => (
                <option value={v.id} key={v.id}>
                  {v.productName} · {v.name} · {money(v.price)} · {v.stock}{' '}
                  available
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity">
            <input
              className="field"
              type="number"
              required
              min="1"
              max="99"
              value={item.quantity}
              onChange={(e) =>
                setItems(
                  items.map((v, j) =>
                    i === j ? { ...v, quantity: Number(e.target.value) } : v,
                  ),
                )
              }
            />
          </Field>
          {items.length > 1 && (
            <Button onClick={() => setItems(items.filter((_, j) => j !== i))}>
              Remove
            </Button>
          )}
        </div>
      ))}
      <Button
        icon="plus"
        disabled={items.length >= 30 || !active.length}
        onClick={() =>
          setItems([
            ...items,
            {
              id:
                active.find((v) => !items.some((i) => i.id === v.id))?.id || '',
              quantity: 1,
            },
          ])
        }
      >
        Add another item
      </Button>
      <Field label="Internal note">
        <textarea
          className="field"
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <div className="detail-line order-total">
        <strong>Order total</strong>
        <strong>{money(total)}</strong>
      </div>
      <p className="permission">
        Prices come from your catalogue. Creation reserves available stock.
        Payment starts pending; no payment is collected or customer message
        sent.
      </p>
      <div className="drawer-footer">
        <Button primary type="submit" disabled={disabled || !active.length}>
          Create order
        </Button>
      </div>
    </form>
  )
}
function EnquiryForm({
  enquiry,
  data,
  save,
  disabled,
}: {
  enquiry?: Enquiry
  data: Snapshot
  save: Save
  disabled: boolean
}) {
  const [form, setForm] = useState({
    name: enquiry?.name || '',
    email: enquiry?.email || '',
    phone: enquiry?.phone || '',
    subject: enquiry?.subject || '',
    channel: enquiry?.channel || 'Website',
    message: enquiry?.message || '',
    notes: enquiry?.notes || '',
    status: enquiry?.status || 'New',
    assigned_to: enquiry?.assigned_to || '',
  })
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        save(
          enquiry ? '/enquiries/' + enquiry.id : '/enquiries',
          enquiry ? 'PUT' : 'POST',
          form,
          'Enquiry saved. No customer message was sent.',
        )
      }}
    >
      {enquiry ? (
        <div className="detail-block">
          <strong>{enquiry.name}</strong>
          <p className="sub">
            {enquiry.email} {enquiry.phone} · {enquiry.channel}
          </p>
          <h2>{enquiry.subject}</h2>
          <p className="enquiry-message">{enquiry.message}</p>
        </div>
      ) : (
        <>
          <Field label="Contact name">
            <input
              className="field"
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Email · optional">
            <input
              className="field"
              type="email"
              maxLength={254}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone · optional">
            <input
              className="field"
              maxLength={30}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Subject">
            <input
              className="field"
              required
              maxLength={200}
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </Field>
          <Field label="Source channel">
            <select
              className="field"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              {['Website', 'WhatsApp', 'Instagram', 'Phone', 'In person'].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Conversation">
            <textarea
              className="field"
              required
              maxLength={5000}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </Field>
        </>
      )}
      {enquiry && (
        <>
          <Field label="Follow-up status">
            <select
              className="field"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {['New', 'In progress', 'Resolved'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Internal notes">
            <textarea
              className="field"
              maxLength={5000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </>
      )}
      <Field label="Assigned to">
        <select
          className="field"
          value={form.assigned_to}
          onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
        >
          <option value="">Unassigned</option>
          {data.team
            .filter((u) => u.active)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      </Field>
      <p className="permission">
        Internal follow-up only. No message will be sent.
      </p>
      <div className="drawer-footer">
        <Button primary type="submit" disabled={disabled}>
          Save enquiry
        </Button>
      </div>
    </form>
  )
}
function MemberForm({
  member,
  disabled,
  save,
  invite,
}: {
  member?: User
  disabled: boolean
  save: Save
  invite: (body: unknown, id?: string) => void
}) {
  const [name, setName] = useState(member?.name || ''),
    [identifier, setEmail] = useState(member?.email || ''),
    [role, setRole] = useState(member?.role || 'staff'),
    [active, setActive] = useState(member?.active ?? true)
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        if (member)
          save(
            '/team/' + member.id,
            'PUT',
            { name, role, active },
            'Team access updated.',
          )
        else invite({ name, email: identifier, role })
      }}
    >
      <Field label="Full name">
        <input
          className="field"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Email address">
        <input
          className="field"
          type="email"
          required
          maxLength={254}
          value={identifier}
          readOnly={Boolean(member)}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Account role">
        <select
          className="field"
          value={role}
          onChange={(e) => setRole(e.target.value as 'owner' | 'staff')}
        >
          <option value="staff">Fulfilment staff</option>
          <option value="owner">Studio owner</option>
        </select>
      </Field>
      {member && (
        <Field label="Account access">
          <select
            className="field"
            value={active ? 'active' : 'inactive'}
            onChange={(e) => setActive(e.target.value === 'active')}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
      )}
      <p className="permission">
        {member
          ? 'The last active owner cannot be removed. Deactivation revokes sessions and unused setup links. Email changes require verified account provisioning.'
          : 'A single-use invitation lets the new member choose their password. You will review a private email preview; no email is sent automatically.'}
      </p>
      <div className="drawer-footer">
        {member && active && (
          <Button disabled={disabled} onClick={() => invite({}, member.id)}>
            {member.invited ? 'New setup link' : 'Create recovery link'}
          </Button>
        )}
        <Button primary type="submit" disabled={disabled}>
          {member ? 'Save access' : 'Create invitation preview'}
        </Button>
      </div>
    </form>
  )
}
function ProfilePage({
  user,
  save,
  refresh,
  preview,
  busy,
  changedPassword,
}: {
  user: User
  save: Save
  refresh: () => Promise<void>
  preview: boolean
  busy: boolean
  changedPassword: () => void
}) {
  const [name, setName] = useState(user.name),
    [phone, setPhone] = useState(user.phone),
    [bio, setBio] = useState(user.bio),
    [current, setCurrent] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [error, setError] = useState(''),
    [working, setWorking] = useState(false)
  const photo = async (file?: File) => {
    if (!file) return
    setError('')
    setWorking(true)
    try {
      await api('/upload', 'POST', {
        kind: 'avatar',
        image: await imageData(file, 2),
      })
      await refresh()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setWorking(false)
    }
  }
  const remove = async () => {
    setWorking(true)
    try {
      await api('/avatar', 'DELETE', {})
      await refresh()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setWorking(false)
    }
  }
  const change = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('The new passwords must match.')
      return
    }
    setWorking(true)
    try {
      await api('/password', 'POST', { currentPassword: current, password })
      setCurrent('')
      setPassword('')
      setConfirm('')
      changedPassword()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setWorking(false)
    }
  }
  return (
    <>
      <Heading
        eyebrow="A little about you"
        title="Your place in the studio."
        sub="Personal details, a familiar face and secure account access."
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="account-grid">
        <section className="card account-card">
          <h2>My profile</h2>
          <p className="sub">The person behind a little care.</p>
          <div className="photo-editor">
            <div className="account-photo">
              <Avatar user={user} />
            </div>
            <div>
              <div className="photo-actions">
                <label className="btn upload-label">
                  Upload photo
                  <input
                    aria-label="Profile photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={preview || busy || working}
                    onChange={(e) => photo(e.target.files?.[0])}
                  />
                </label>
                <Button
                  disabled={preview || busy || working || !user.avatar}
                  onClick={remove}
                >
                  Remove
                </Button>
              </div>
              <div className="photo-help">PNG, JPEG or WebP · Up to 2 MB.</div>
            </div>
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              save(
                '/profile',
                'PUT',
                { name, phone, bio },
                'Your profile has been saved.',
              )
            }}
          >
            <Field label="Display name">
              <input
                className="field"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email identifier">
              <input
                className="field"
                type="email"
                readOnly
                value={user.email}
              />
            </Field>
            <p className="permission">
              Contact your owner to provision a different email identity. Email
              verification delivery is not configured.
            </p>
            <Field label="Phone number">
              <input
                className="field"
                type="tel"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label="A little about you">
              <textarea
                className="field"
                rows={3}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </Field>
            <div className="drawer-footer">
              <Button
                primary
                type="submit"
                disabled={preview || busy || working}
              >
                Save profile
              </Button>
            </div>
          </form>
        </section>
        <section className="card account-card">
          <h2>Keep your account secure</h2>
          <p className="sub">Choose a password that’s yours alone.</p>
          <form className="form" onSubmit={change}>
            <Field label="Current password">
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field label="New password">
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
            <p className="permission">
              Use 12–128 characters. Changing your password signs out all
              current sessions. Passwords are stored only as salted hashes.
            </p>
            <div className="drawer-footer">
              <Button
                primary
                type="submit"
                disabled={preview || busy || working}
              >
                Update password
              </Button>
            </div>
          </form>
          <div className="account-summary">
            <div className="avatar">
              <Avatar user={user} />
            </div>
            <div>
              <strong>{user.name}</strong>
              <small className="member-contact">
                {user.role === 'owner' ? 'Studio owner' : 'Fulfilment staff'}
              </small>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
