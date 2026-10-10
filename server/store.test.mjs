import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDatabase, createStore, validSignature } from './store.mjs'

const env = {
  RAZORPAY_KEY_ID: 'rzp_test_fixture',
  RAZORPAY_KEY_SECRET: 'fixture-secret',
  RAZORPAY_WEBHOOK_SECRET: 'fixture-webhook',
  LUMORA_STORE_LIVE: 'true',
  LUMORA_SHIPPING_INR: '49',
}
const customer = {
  name: 'Test Customer',
  email: 'customer@example.com',
  phone: '9876543210',
  address: '10 Test Street',
  city: 'Kochi',
  state: 'Kerala',
  postalCode: '682001',
}
const input = () => ({
  items: [{ id: 'amber-hour', quantity: 1 }],
  customer: { ...customer },
  amount: 1,
})
function fixture(t, payment = {}) {
  const db = createDatabase(':memory:')
  t.after(() => db.close())
  const calls = []
  const request = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith('/orders')) {
      const data = JSON.parse(options.body)
      return { ok: true, json: async () => ({ id: 'order_fixture', ...data }) }
    }
    return {
      ok: true,
      json: async () => ({
        id: 'pay_fixture',
        order_id: 'order_fixture',
        amount: 94800,
        currency: 'INR',
        status: 'captured',
        ...payment,
      }),
    }
  }
  return { db, calls, store: createStore({ db, env, request }) }
}
const signature = (payload, secret = env.RAZORPAY_KEY_SECRET) =>
  createHmac('sha256', secret).update(payload).digest('hex')
const paymentBody = () => ({
  razorpay_order_id: 'order_fixture',
  razorpay_payment_id: 'pay_fixture',
  razorpay_signature: signature('order_fixture|pay_fixture'),
})

test('disabled checkout never calls the payment provider or accepts orders', async (t) => {
  const db = createDatabase(':memory:')
  t.after(() => db.close())
  const store = createStore({
    db,
    env: {},
    request: () => assert.fail('Network call while disabled'),
  })
  assert.equal(store.config().checkoutReady, false)
  assert.equal(store.config().keyId, null)
  await assert.rejects(
    store.createOrder(input()),
    (error) => error.status === 503,
  )
})
test('order amount uses catalog prices and configured delivery, ignoring browser prices', async (t) => {
  const { store, db, calls } = fixture(t)
  const order = await store.createOrder(input())
  assert.equal(order.amount, 94800)
  assert.equal(order.currency, 'INR')
  assert.equal(JSON.parse(calls[0].options.body).amount, 94800)
  const saved = db.prepare('SELECT * FROM orders').get()
  assert.equal(saved.status, 'created')
  assert.equal(JSON.parse(saved.customer).postalCode, '682001')
  assert.equal(JSON.parse(saved.items)[0].unitPrice, 89900)
  assert.equal(JSON.stringify(store.config()).includes('fixture-secret'), false)
})
test('invalid, duplicated, fractional, or excessive quantities are rejected', async (t) => {
  const { store, calls } = fixture(t)
  for (const items of [
    [],
    [{ id: 'unknown', quantity: 1 }],
    [{ id: 'amber-hour', quantity: 0 }],
    [{ id: 'amber-hour', quantity: 1.5 }],
    [{ id: 'amber-hour', quantity: 100 }],
    [
      { id: 'amber-hour', quantity: 1 },
      { id: 'amber-hour', quantity: 1 },
    ],
  ])
    await assert.rejects(
      store.createOrder({ ...input(), items }),
      (error) => error.status === 400,
    )
  assert.equal(calls.length, 0)
})
test('delivery information must be complete and valid', async (t) => {
  const { store, calls } = fixture(t)
  for (const invalid of [
    { email: 'invalid' },
    { phone: '--------- ' },
    { postalCode: 'abc123' },
    { address: '' },
  ])
    await assert.rejects(
      store.createOrder({ ...input(), customer: { ...customer, ...invalid } }),
      (error) => error.status === 400,
    )
  assert.equal(calls.length, 0)
})
test('forged signatures do not trigger payment lookups or mark orders paid', async (t) => {
  const { store, db, calls } = fixture(t)
  await store.createOrder(input())
  await assert.rejects(
    store.verifyPayment({
      ...paymentBody(),
      razorpay_signature: '0'.repeat(64),
    }),
    (error) => error.status === 400,
  )
  assert.equal(calls.length, 1)
  assert.equal(db.prepare('SELECT status FROM orders').get().status, 'created')
  assert.equal(validSignature('body', 'invalid', 'fixture'), false)
})
test('captured payments are verified and repeated callbacks are idempotent', async (t) => {
  const { store, db } = fixture(t)
  await store.createOrder(input())
  const first = await store.verifyPayment(paymentBody())
  const repeat = await store.verifyPayment(paymentBody())
  assert.deepEqual(repeat, first)
  assert.equal(first.status, 'paid')
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM orders').get().count,
    1,
  )
  assert.equal(
    db.prepare('SELECT payment_id FROM orders').get().payment_id,
    'pay_fixture',
  )
})
test('wrong payment amount, currency, order, and reference are rejected', async (t) => {
  for (const mismatch of [
    { amount: 1 },
    { currency: 'USD' },
    { order_id: 'order_other' },
    { id: 'pay_other' },
  ]) {
    const { store, db } = fixture(t, mismatch)
    await store.createOrder(input())
    await assert.rejects(store.verifyPayment(paymentBody()), (error) =>
      [400, 409].includes(error.status),
    )
    assert.equal(
      db.prepare('SELECT status FROM orders').get().status,
      'created',
    )
  }
})
test('authorized payments are captured with the stored amount', async (t) => {
  const db = createDatabase(':memory:')
  t.after(() => db.close())
  let captureAmount
  const store = createStore({
    db,
    env,
    request: async (url, options) => {
      if (url.endsWith('/orders'))
        return {
          ok: true,
          json: async () => ({
            id: 'order_fixture',
            ...JSON.parse(options.body),
          }),
        }
      if (url.endsWith('/capture'))
        captureAmount = JSON.parse(options.body).amount
      return {
        ok: true,
        json: async () => ({
          id: 'pay_fixture',
          order_id: 'order_fixture',
          amount: 94800,
          currency: 'INR',
          status: url.endsWith('/capture') ? 'captured' : 'authorized',
        }),
      }
    },
  })
  await store.createOrder(input())
  assert.equal((await store.verifyPayment(paymentBody())).status, 'paid')
  assert.equal(captureAmount, 94800)
})
test('failed capture is not reported as a successful payment', async (t) => {
  const db = createDatabase(':memory:')
  t.after(() => db.close())
  const store = createStore({
    db,
    env,
    request: async (url, options) => {
      if (url.endsWith('/orders'))
        return {
          ok: true,
          json: async () => ({
            id: 'order_fixture',
            ...JSON.parse(options.body),
          }),
        }
      if (url.endsWith('/capture')) return { ok: false }
      return {
        ok: true,
        json: async () => ({
          id: 'pay_fixture',
          order_id: 'order_fixture',
          amount: 94800,
          currency: 'INR',
          status: 'authorized',
        }),
      }
    },
  })
  await store.createOrder(input())
  await assert.rejects(
    store.verifyPayment(paymentBody()),
    (error) => error.status === 409,
  )
  assert.equal(db.prepare('SELECT status FROM orders').get().status, 'created')
})
test('webhooks require a valid raw-body signature and are idempotent', async (t) => {
  const { store, db } = fixture(t)
  await store.createOrder(input())
  const raw = Buffer.from(
    JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_fixture',
            order_id: 'order_fixture',
            amount: 94800,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    }),
  )
  assert.throws(
    () => store.webhook(raw, '0'.repeat(64)),
    (error) => error.status === 400,
  )
  assert.deepEqual(
    store.webhook(raw, signature(raw, env.RAZORPAY_WEBHOOK_SECRET)),
    { received: true },
  )
  assert.deepEqual(
    store.webhook(raw, signature(raw, env.RAZORPAY_WEBHOOK_SECRET)),
    { received: true },
  )
  assert.equal(db.prepare('SELECT status FROM orders').get().status, 'paid')
})
test('provider failure does not create a local order', async (t) => {
  const db = createDatabase(':memory:')
  t.after(() => db.close())
  const store = createStore({
    db,
    env,
    request: async () => {
      throw new Error('fixture network failure')
    },
  })
  await assert.rejects(
    store.createOrder(input()),
    (error) => error.status === 502,
  )
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM orders').get().count,
    0,
  )
})
test('order records survive reopening the database', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'lumora-orders-'))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const filename = join(folder, 'orders.sqlite')
  const db = createDatabase(filename)
  db.prepare(
    'INSERT INTO orders (id,receipt,amount,currency,items,customer) VALUES (?,?,?,?,?,?)',
  ).run('order_saved', 'receipt', 89900, 'INR', '[]', '{}')
  db.close()
  const restored = createDatabase(filename)
  assert.equal(
    restored
      .prepare('SELECT amount FROM orders WHERE id = ?')
      .get('order_saved').amount,
    89900,
  )
  restored.close()
})
