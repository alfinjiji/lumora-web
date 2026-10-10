import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { products } from '../src/products.ts'

export class StoreError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function createDatabase(filename) {
  if (filename !== ':memory:')
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(filename)
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, receipt TEXT NOT NULL, amount INTEGER NOT NULL,
    currency TEXT NOT NULL, items TEXT NOT NULL, customer TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created', payment_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
  return db
}

export function validSignature(payload, signature, secret) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature))
    return false
  const expected = createHmac('sha256', secret).update(payload).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}

export function createStore({ db, env = process.env, request = fetch }) {
  const shipping = Number(env.LUMORA_SHIPPING_INR || '0')
  if (
    !Number.isFinite(shipping) ||
    shipping < 0 ||
    shipping > 10000 ||
    !Number.isInteger(shipping * 100)
  )
    throw new Error('Invalid LUMORA_SHIPPING_INR')
  const shippingPaise = Math.round(shipping * 100)
  const ready = Boolean(
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET &&
    env.LUMORA_STORE_LIVE === 'true',
  )
  const requireReady = () => {
    if (!ready)
      throw new StoreError(
        503,
        'Checkout is not enabled yet. No payment or order has been processed.',
      )
  }
  const api = async (path, options = {}) => {
    let response
    try {
      response = await request(`https://api.razorpay.com/v1${path}`, {
        ...options,
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        },
      })
    } catch {
      throw new StoreError(
        502,
        'The payment service is unavailable. Please try again.',
      )
    }
    if (!response.ok)
      throw new StoreError(
        502,
        'The payment service could not complete this request. Please try again.',
      )
    return response.json()
  }
  const findOrder = (id) =>
    db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
  const checkPayment = (payment, order) => {
    if (
      payment.order_id !== order.id ||
      payment.amount !== order.amount ||
      payment.currency !== 'INR'
    )
      throw new StoreError(400, 'Payment does not match this order.')
  }
  const markPaid = (order, payment) => {
    const existing = findOrder(order.id)
    if (existing.status === 'paid' && existing.payment_id !== payment.id)
      throw new StoreError(409, 'This order already has a different payment.')
    db.prepare(
      "UPDATE orders SET status = 'paid', payment_id = ? WHERE id = ?",
    ).run(payment.id, order.id)
    return {
      status: 'paid',
      receipt: order.receipt,
      amount: order.amount,
      currency: 'INR',
      items: JSON.parse(order.items),
    }
  }
  return {
    config() {
      return {
        checkoutReady: ready,
        keyId: ready ? env.RAZORPAY_KEY_ID : null,
        currency: 'INR',
        shippingPaise,
        products,
      }
    },
    async createOrder(body) {
      requireReady()
      if (
        !Array.isArray(body.items) ||
        !body.items.length ||
        body.items.length > products.length
      )
        throw new StoreError(400, 'Choose at least one candle.')
      const seen = new Set()
      const items = body.items.map((item) => {
        const product = products.find((product) => product.id === item?.id)
        if (
          !product ||
          seen.has(item.id) ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 99
        )
          throw new StoreError(400, 'Invalid candle or quantity.')
        seen.add(item.id)
        return {
          id: product.id,
          name: product.name,
          quantity: item.quantity,
          unitPrice: Math.round(product.price * 100),
        }
      })
      const customer = {}
      for (const [key, min, max] of [
        ['name', 2, 100],
        ['email', 5, 150],
        ['phone', 9, 20],
        ['address', 5, 250],
        ['city', 2, 80],
        ['state', 2, 80],
        ['postalCode', 6, 6],
      ]) {
        const value = body.customer?.[key]
        if (
          typeof value !== 'string' ||
          value.trim().length < min ||
          value.trim().length > max
        )
          throw new StoreError(400, 'Please complete your delivery details.')
        customer[key] = value.trim()
      }
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
        !/^\+?[\d ()-]{9,20}$/.test(customer.phone) ||
        customer.phone.replace(/\D/g, '').length < 9 ||
        !/^\d{6}$/.test(customer.postalCode)
      )
        throw new StoreError(
          400,
          'Please check your email, phone number, and six-digit PIN code.',
        )
      customer.country = 'India'
      const amount =
        items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) +
        shippingPaise
      if (!Number.isSafeInteger(amount) || amount > 10000000)
        throw new StoreError(
          400,
          'This order is too large for online checkout.',
        )
      const receipt = `lum_${randomUUID().replaceAll('-', '').slice(0, 24)}`
      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({ amount, currency: 'INR', receipt }),
      })
      if (
        typeof order.id !== 'string' ||
        !/^order_[A-Za-z0-9]+$/.test(order.id) ||
        order.amount !== amount ||
        order.currency !== 'INR'
      )
        throw new StoreError(
          502,
          'The payment service returned an invalid order.',
        )
      db.prepare(
        'INSERT INTO orders (id, receipt, amount, currency, items, customer) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        order.id,
        receipt,
        amount,
        'INR',
        JSON.stringify(items),
        JSON.stringify(customer),
      )
      return {
        id: order.id,
        amount,
        currency: 'INR',
        keyId: env.RAZORPAY_KEY_ID,
      }
    },
    async verifyPayment(body) {
      requireReady()
      if (
        typeof body.razorpay_order_id !== 'string' ||
        !/^order_[A-Za-z0-9]+$/.test(body.razorpay_order_id) ||
        typeof body.razorpay_payment_id !== 'string' ||
        !/^pay_[A-Za-z0-9]+$/.test(body.razorpay_payment_id)
      )
        throw new StoreError(400, 'Invalid payment reference.')
      const order = findOrder(body.razorpay_order_id)
      if (!order) throw new StoreError(404, 'Order not found.')
      if (
        !validSignature(
          `${order.id}|${body.razorpay_payment_id}`,
          body.razorpay_signature,
          env.RAZORPAY_KEY_SECRET,
        )
      )
        throw new StoreError(400, 'Payment verification failed.')
      let payment = await api(`/payments/${body.razorpay_payment_id}`)
      checkPayment(payment, order)
      if (payment.id !== body.razorpay_payment_id)
        throw new StoreError(
          400,
          'Payment reference does not match this order.',
        )
      if (payment.status === 'authorized') {
        try {
          payment = await api(`/payments/${payment.id}/capture`, {
            method: 'POST',
            body: JSON.stringify({ amount: order.amount, currency: 'INR' }),
          })
        } catch {
          payment = await api(`/payments/${body.razorpay_payment_id}`)
        }
        checkPayment(payment, order)
      }
      if (
        payment.status !== 'captured' ||
        payment.id !== body.razorpay_payment_id
      )
        throw new StoreError(
          409,
          'Payment is awaiting confirmation. Your bag is saved; please do not pay again.',
        )
      return markPaid(order, payment)
    },
    webhook(raw, signature) {
      if (!env.RAZORPAY_WEBHOOK_SECRET)
        throw new StoreError(503, 'Webhook is not configured.')
      if (!validSignature(raw, signature, env.RAZORPAY_WEBHOOK_SECRET))
        throw new StoreError(400, 'Invalid webhook signature.')
      let event
      try {
        event = JSON.parse(raw.toString())
      } catch {
        throw new StoreError(400, 'Invalid webhook payload.')
      }
      if (event.event !== 'payment.captured') return { received: true }
      const payment = event.payload?.payment?.entity
      const order = payment && findOrder(payment.order_id)
      if (!order) throw new StoreError(404, 'Order not found.')
      checkPayment(payment, order)
      if (
        payment.status !== 'captured' ||
        typeof payment.id !== 'string' ||
        !/^pay_[A-Za-z0-9]+$/.test(payment.id)
      )
        throw new StoreError(400, 'Invalid captured payment.')
      markPaid(order, payment)
      return { received: true }
    },
  }
}
