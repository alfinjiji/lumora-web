import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { createDatabase, createStore } from './store.mjs'
import { createCatalog, uid } from './admin-db.mjs'
import { createAdminHandler } from './admin.mjs'
import { checkPassword } from './admin-auth.mjs'
const password = 'Fixture-Light-2026!'
async function fixture(t) {
  const db = createDatabase(':memory:'),
    catalog = createCatalog(db),
    dir = mkdtempSync(join(tmpdir(), 'auraflare-admin-test-')),
    admin = createAdminHandler({ db, catalog, dataDir: dir, env: {} })
  const server = createServer(async (req, res) => {
    try {
      if (req.url === '/api/store') {
        res.setHeader('content-type', 'application/json')
        return res.end(
          JSON.stringify(createStore({ db, catalog, env: {} }).config()),
        )
      }
      await admin.handle(
        req,
        res,
        new URL(req.url, 'http://localhost').pathname,
      )
    } catch (e) {
      res.writeHead(e.status || 500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  const client = () => {
    let cookie = '',
      csrf = ''
    return {
      async request(path, method = 'GET', body, extra = {}) {
        const headers = {
          ...(cookie ? { cookie } : {}),
          ...(method === 'GET'
            ? {}
            : {
                'content-type': 'application/json',
                'x-auraflare-request': 'admin',
                'x-csrf-token': csrf,
              }),
          ...extra,
        }
        const response = await fetch(base + '/api/admin' + path, {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
        const set = response.headers.get('set-cookie')
        if (set) cookie = set.split(';')[0]
        const content = response.headers.get('content-type')
        const data = content?.includes('application/json')
          ? await response.json()
          : Buffer.from(await response.arrayBuffer())
        if (data.csrf) csrf = data.csrf
        return { status: response.status, data, headers: response.headers }
      },
      get cookie() {
        return cookie
      },
    }
  }
  const owner = client(),
    setup = admin.auth.bootstrap('Fixture Owner', 'owner@example.com')
  assert.equal(
    (
      await owner.request('/accept-invitation', 'POST', {
        token: setup.token,
        password,
      })
    ).status,
    200,
  )
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })
  const staff = async () => {
    const r = await owner.request('/team', 'POST', {
      name: 'Fixture Staff',
      email: 'staff@example.com',
      role: 'staff',
    })
    assert.equal(r.status, 201)
    const token = new URL(r.data.preview.url).hash.slice(7),
      account = client()
    assert.equal(
      (await account.request('/accept-invitation', 'POST', { token, password }))
        .status,
      200,
    )
    return account
  }
  return { db, catalog, admin, dir, base, owner, client, staff, setup }
}
const direct = (id, qty = 1) => ({
  requestId: uid(),
  channel: 'WhatsApp',
  customer: { name: 'Fixture Customer', email: 'customer@example.com' },
  items: [{ id, quantity: qty }],
})
test('migration preserves the public catalogue and seeds no customer records or authenticated users', async (t) => {
  const f = await fixture(t)
  assert.equal(f.catalog.publicProducts().length, 8)
  assert.equal(f.catalog.publicProducts()[0].tag, 'A LITTLE WARMTH')
  assert.equal(f.db.prepare('SELECT count(*) n FROM orders').get().n, 0)
  assert.equal(
    f.db.prepare('SELECT count(*) n FROM studio_enquiries').get().n,
    0,
  )
  assert.equal(f.catalog.lookup('jar').stock, 0)
  assert.throws(
    () => f.admin.auth.bootstrap('Another', 'another@example.com'),
    /already exists/,
  )
  assert.equal(f.db.prepare('SELECT count(*) n FROM studio_users').get().n, 1)
})
test('protected endpoints require a session and enforce CSRF and same-origin checks', async (t) => {
  const f = await fixture(t),
    guest = f.client()
  for (const [path, method] of [
    ['/snapshot', 'GET'],
    ['/profile', 'PUT'],
    ['/products', 'POST'],
    ['/team', 'POST'],
    ['/content', 'PUT'],
    ['/inventory', 'POST'],
    ['/orders', 'POST'],
    ['/upload', 'POST'],
    ['/avatar/other', 'GET'],
  ])
    assert.equal(
      (await guest.request(path, method, method === 'GET' ? undefined : {}))
        .status,
      401,
      path,
    )
  assert.equal(
    (
      await f.owner.request(
        '/profile',
        'PUT',
        { name: 'No' },
        { 'x-csrf-token': 'wrong' },
      )
    ).status,
    403,
  )
  assert.equal(
    (
      await f.owner.request(
        '/profile',
        'PUT',
        { name: 'No' },
        { origin: 'https://attacker.example' },
      )
    ).status,
    403,
  )
})
test('login rejects wrong credentials, rotates sessions and does not accept a requested role', async (t) => {
  const f = await fixture(t),
    staff = await f.staff(),
    guest = f.client()
  assert.equal(
    (
      await guest.request('/login', 'POST', {
        email: 'owner@example.com',
        password: 'wrong',
      })
    ).status,
    401,
  )
  const r = await guest.request('/login', 'POST', {
    email: 'STAFF@example.com',
    password,
    role: 'owner',
  })
  assert.equal(r.status, 200)
  assert.equal(r.data.user.role, 'staff')
  assert.match(r.headers.get('set-cookie'), /HttpOnly/)
  assert.match(r.headers.get('set-cookie'), /SameSite=Strict/)
  assert.notEqual(staff.cookie, guest.cookie)
  assert.equal((await guest.request('/logout', 'POST', {})).status, 200)
  assert.equal((await guest.request('/snapshot')).status, 401)
})
test('invitation tokens are hashed, expire, work once and never send passwords or email', async (t) => {
  const f = await fixture(t)
  const result = await f.owner.request('/team', 'POST', {
    name: 'New Member',
    email: 'new@example.com',
    role: 'staff',
  })
  const { preview } = result.data
  assert.equal(preview.sent, false)
  assert.match(preview.url, /#setup=/)
  const raw = new URL(preview.url).hash.slice(7)
  assert.notEqual(
    f.db.prepare('SELECT hash FROM studio_tokens').get().hash,
    raw,
  )
  assert.equal(
    f.db
      .prepare('SELECT password_hash FROM studio_users WHERE email=?')
      .get('new@example.com').password_hash,
    null,
  )
  const account = f.client()
  assert.equal(
    (
      await account.request('/accept-invitation', 'POST', {
        token: raw,
        password,
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await account.request('/accept-invitation', 'POST', {
        token: raw,
        password,
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await f.owner.request('/team', 'POST', {
        name: 'Duplicate',
        email: 'NEW@example.com',
        role: 'staff',
      })
    ).status,
    409,
  )
  const expired = await f.owner.request('/team', 'POST', {
    name: 'Expired Member',
    email: 'expired@example.com',
    role: 'staff',
  })
  f.db.prepare('UPDATE studio_tokens SET expires=0').run()
  assert.equal(
    (
      await f
        .client()
        .request('/accept-invitation', 'POST', {
          token: new URL(expired.data.preview.url).hash.slice(7),
          password,
        })
    ).status,
    400,
  )
})
test('staff cannot edit products, publish content, manage team or record payments', async (t) => {
  const f = await fixture(t),
    staff = await f.staff()
  for (const [path, method] of [
    ['/products', 'POST'],
    ['/products/jar', 'PUT'],
    ['/content', 'PUT'],
    ['/team', 'POST'],
    ['/team/unknown', 'PUT'],
    ['/orders/unknown/payment', 'POST'],
  ])
    assert.equal((await staff.request(path, method, {})).status, 403, path)
  assert.equal(
    (
      await staff.request('/upload', 'POST', {
        kind: 'banner',
        image: 'invalid',
      })
    ).status,
    403,
  )
  const s = (await staff.request('/snapshot')).data
  assert.equal(s.content, null)
  assert.equal(s.user.role, 'staff')
  assert.equal(s.products.length, 8)
})
test('the final usable owner is protected even when another owner invitation is pending', async (t) => {
  const f = await fixture(t),
    ownerId = f.setup.user.id
  await f.owner.request('/team', 'POST', {
    name: 'Pending Owner',
    email: 'pending@example.com',
    role: 'owner',
  })
  for (const change of [
    { active: false, role: 'owner' },
    { active: true, role: 'staff' },
  ])
    assert.equal(
      (
        await f.owner.request('/team/' + ownerId, 'PUT', {
          name: 'Owner',
          ...change,
        })
      ).status,
      409,
    )
})
test('deactivation immediately revokes sessions and setup links', async (t) => {
  const f = await fixture(t),
    staff = await f.staff()
  const member = f.db
    .prepare("SELECT * FROM studio_users WHERE email='staff@example.com'")
    .get()
  await f.owner.request('/team/' + member.id + '/invitation', 'POST', {})
  assert.equal(
    (
      await f.owner.request('/team/' + member.id, 'PUT', {
        name: member.name,
        role: 'staff',
        active: false,
      })
    ).status,
    200,
  )
  assert.equal((await staff.request('/snapshot')).status, 401)
  assert.equal(
    f.db
      .prepare('SELECT count(*) n FROM studio_tokens WHERE user_id=?')
      .get(member.id).n,
    0,
  )
  assert.equal(
    (
      await f
        .client()
        .request('/login', 'POST', { email: member.email, password })
    ).status,
    401,
  )
})
test('profile updates apply only to the signed-in user and passwords require current verification', async (t) => {
  const f = await fixture(t),
    staff = await f.staff()
  assert.equal(
    (
      await staff.request('/profile', 'PUT', {
        name: 'Updated Staff',
        phone: '9876543210',
        bio: 'Packing with care',
        id: f.setup.user.id,
        email: 'hijack@example.com',
        role: 'owner',
      })
    ).status,
    200,
  )
  assert.equal(
    f.db
      .prepare('SELECT name FROM studio_users WHERE id=?')
      .get(f.setup.user.id).name,
    'Fixture Owner',
  )
  assert.equal(
    (
      await staff.request('/password', 'POST', {
        currentPassword: 'wrong',
        password: 'Replacement-Light-2026!',
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await staff.request('/password', 'POST', {
        currentPassword: password,
        password: 'short',
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await staff.request('/password', 'POST', {
        currentPassword: password,
        password: 'Replacement-Light-2026!',
      })
    ).status,
    200,
  )
  assert.equal((await staff.request('/snapshot')).status, 401)
  const stored = f.db
    .prepare(
      "SELECT password_hash FROM studio_users WHERE email='staff@example.com'",
    )
    .get().password_hash
  assert.notEqual(stored, 'Replacement-Light-2026!')
  assert.ok(await checkPassword('Replacement-Light-2026!', stored))
  assert.equal(
    (
      await f
        .client()
        .request('/login', 'POST', { email: 'staff@example.com', password })
    ).status,
    401,
  )
})
test('uploads validate real image bytes, resize avatars and prevent cross-purpose staff uploads', async (t) => {
  const f = await fixture(t),
    staff = await f.staff()
  const png = await sharp({
    create: { width: 400, height: 500, channels: 3, background: '#42212d' },
  })
    .png()
    .toBuffer()
  const r = await staff.request('/upload', 'POST', {
    kind: 'avatar',
    image: 'data:image/png;base64,' + png.toString('base64'),
  })
  assert.equal(r.status, 200)
  const avatar = await staff.request(
    new URL(r.data.url, 'http://localhost').pathname.slice(10),
  )
  assert.equal(avatar.status, 200)
  const meta = await sharp(avatar.data).metadata()
  assert.equal(meta.format, 'webp')
  assert.ok(meta.width <= 256 && meta.height <= 256)
  assert.equal(
    (
      await staff.request('/upload', 'POST', {
        kind: 'avatar',
        image:
          'data:image/png;base64,' +
          Buffer.from('<svg><script>alert(1)</script></svg>').toString(
            'base64',
          ),
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await staff.request('/upload', 'POST', {
        kind: 'avatar',
        image:
          'data:image/png;base64,' +
          Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64'),
      })
    ).status,
    413,
  )
  assert.equal((await staff.request('/avatar', 'DELETE', {})).status, 200)
  assert.equal(
    (
      await staff.request(
        new URL(r.data.url, 'http://localhost').pathname.slice(10),
      )
    ).status,
    404,
  )
})
test('products persist variants, reject duplicate SKUs and publish only active records', async (t) => {
  const f = await fixture(t)
  const payload = {
    name: 'Fixture Candle',
    collection: 'New Collection',
    note: 'Test fragrance',
    description: 'A fixture product.',
    category: ['Home', 'Gifting'],
    image: '/images/auraflare/jar.webp',
    status: 'Draft',
    reason: 'Initial count',
    variants: [
      { name: 'Small / Ivory', sku: 'TEST-S', price: 49900, stock: 10 },
      { name: 'Large / Wine', sku: 'TEST-L', price: 79900, stock: 12 },
    ],
  }
  assert.equal(
    (await f.owner.request('/products', 'POST', payload)).status,
    200,
  )
  let p = f.catalog.allProducts().find((p) => p.name === payload.name)
  assert.equal(p.variants.length, 2)
  assert.equal(f.catalog.publicProducts().length, 8)
  assert.equal(
    (
      await f.owner.request('/products/' + p.id, 'PUT', {
        ...payload,
        status: 'Active',
        variants: p.variants,
      })
    ).status,
    200,
  )
  assert.equal(f.catalog.publicProducts().length, 9)
  assert.equal(
    (await f.owner.request('/products', 'POST', payload)).status,
    409,
  )
  assert.equal(f.catalog.allProducts().length, 9)
  const published=f.catalog.publicProducts().find(item=>item.id===p.id)
  assert.deepEqual(published.variants.map(v=>v.price),[499,799])
})
test('stock adjustments require a reason, prevent negative quantities and record history', async (t) => {
  const f = await fixture(t),
    staff = await f.staff()
  assert.equal(
    (
      await staff.request('/inventory', 'POST', {
        variantId: 'jar',
        delta: 5,
        reason: '',
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await staff.request('/inventory', 'POST', {
        variantId: 'jar',
        delta: 5,
        reason: 'New batch',
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await staff.request('/inventory', 'POST', {
        variantId: 'jar',
        delta: -6,
        reason: 'Damaged stock',
      })
    ).status,
    400,
  )
  assert.equal(f.catalog.lookup('jar').stock, 5)
  assert.equal(
    f.db.prepare('SELECT count(*) n FROM studio_stock_moves').get().n,
    1,
  )
})
test('direct orders reserve atomically, retry idempotently and do not trust browser totals', async (t) => {
  const f = await fixture(t),
    staff = await f.staff()
  f.catalog.move('jar', 3, 'Initial count')
  const body = direct('jar', 2)
  body.amount = 1
  assert.equal((await staff.request('/orders', 'POST', body)).status, 200)
  assert.equal((await staff.request('/orders', 'POST', body)).status, 200)
  assert.equal(f.db.prepare('SELECT count(*) n FROM orders').get().n, 1)
  assert.equal(f.db.prepare('SELECT amount FROM orders').get().amount, 129800)
  assert.equal(f.catalog.lookup('jar').stock, 1)
  assert.equal(
    (await staff.request('/orders', 'POST', direct('jar', 2))).status,
    409,
  )
  assert.equal(f.catalog.lookup('jar').stock, 1)
  assert.equal(f.db.prepare('SELECT count(*) n FROM orders').get().n, 1)
  assert.equal(
    (
      await staff.request('/orders', 'POST', {
        ...body,
        items: [{ id: 'jar', quantity: 1 }],
      })
    ).status,
    409,
  )
})
test('order transitions require real payment and tracking, cancellation releases stock once', async (t) => {
  const f = await fixture(t)
  f.catalog.move('jar', 3, 'Initial count')
  await f.owner.request('/orders', 'POST', direct('jar', 2))
  const order = f.db.prepare('SELECT * FROM orders').get()
  assert.equal(
    (
      await f.owner.request('/orders/' + order.id, 'PATCH', {
        fulfilment: 'Processing',
      })
    ).status,
    409,
  )
  assert.equal(
    (
      await f.owner.request('/orders/' + order.id + '/payment', 'POST', {
        amount: order.amount,
        reference: 'CASH-001',
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await f.owner.request('/orders/' + order.id + '/payment', 'POST', {
        amount: order.amount,
        reference: 'CASH-002',
      })
    ).status,
    409,
  )
  assert.equal(
    (
      await f.owner.request('/orders/' + order.id, 'PATCH', {
        fulfilment: 'Processing',
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await f.owner.request('/orders/' + order.id, 'PATCH', {
        fulfilment: 'Shipped',
      })
    ).status,
    400,
  )
  assert.equal(
    (
      await f.owner.request('/orders/' + order.id, 'PATCH', {
        fulfilment: 'Cancelled',
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await f.owner.request('/orders/' + order.id, 'PATCH', {
        fulfilment: 'Cancelled',
      })
    ).status,
    200,
  )
  assert.equal(f.catalog.lookup('jar').stock, 3)
})
test('website checkout uses managed prices and reservations, releasing them on provider failure', async (t) => {
  const f = await fixture(t)
  f.catalog.move('jar', 3, 'Initial count')
  const env = {
    RAZORPAY_KEY_ID: 'fixture',
    RAZORPAY_KEY_SECRET: 'fixture',
    AURAFLARE_STORE_LIVE: 'true',
  }
  const customer = {
    name: 'Fixture Customer',
    email: 'test@example.com',
    phone: '9876543210',
    address: '10 Test Road',
    city: 'Kochi',
    state: 'Kerala',
    postalCode: '682001',
  }
  const failure = createStore({
    db: f.db,
    catalog: f.catalog,
    env,
    request: async () => {
      throw new Error('Fixture offline')
    },
  })
  await assert.rejects(
    () =>
      failure.createOrder({ items: [{ id: 'jar', quantity: 2 }], customer }),
    /unavailable/,
  )
  assert.equal(f.catalog.lookup('jar').stock, 3)
  let counter = 0
  const store = createStore({
    db: f.db,
    catalog: f.catalog,
    env,
    request: async (_url, options) => ({
      ok: true,
      json: async () => ({
        id: 'order_fixture' + ++counter,
        ...JSON.parse(options.body),
      }),
    }),
  })
  const results = await Promise.allSettled([
    store.createOrder({ items: [{ id: 'jar', quantity: 2 }], customer }),
    store.createOrder({ items: [{ id: 'jar', quantity: 2 }], customer }),
  ])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(f.catalog.lookup('jar').stock, 1)
  const order = f.db.prepare('SELECT * FROM orders').get()
  assert.equal(order.amount, 129800)
  assert.equal(
    (
      await f.owner.request('/orders/' + order.id + '/payment', 'POST', {
        amount: order.amount,
        reference: 'FORGED-001',
      })
    ).status,
    403,
  )
})
test('content drafts remain private until publication, and enquiries send no external messages', async (t) => {
  const f = await fixture(t)
  const old = f.catalog.published(),
    draft = {
      ...old,
      headline: 'An updated little light.',
      featured: 'Gifting',
    }
  assert.equal((await f.owner.request('/content', 'PUT', draft)).status, 200)
  assert.equal(f.catalog.published().headline, old.headline)
  assert.equal(
    (await f.owner.request('/content', 'PUT', { ...draft, publish: true }))
      .status,
    200,
  )
  const publicData = await (await fetch(f.base + '/api/store')).json()
  assert.equal(publicData.content.headline, draft.headline)
  assert.equal(publicData.content.featured, 'Gifting')
  const staff = await f.staff()
  assert.equal(
    (
      await staff.request('/enquiries', 'POST', {
        name: 'Fixture Contact',
        email: 'hello@example.com',
        subject: 'Gifting enquiry',
        channel: 'Instagram',
        message: 'Please share gift options.',
      })
    ).status,
    200,
  )
  const enquiry = f.db.prepare('SELECT * FROM studio_enquiries').get()
  assert.equal(
    (
      await staff.request('/enquiries/' + enquiry.id, 'PUT', {
        status: 'In progress',
        notes: 'Follow up next week',
        assigned_to: null,
      })
    ).status,
    200,
  )
  assert.equal(
    f.db.prepare('SELECT notes FROM studio_enquiries').get().notes,
    'Follow up next week',
  )
})

test('admin migrations preserve legacy orders and managed records across database restarts', async t => {
  const folder=mkdtempSync(join(tmpdir(),'auraflare-restart-test-')),file=join(folder,'orders.sqlite')
  t.after(()=>rmSync(folder,{recursive:true,force:true}))
  let db=createDatabase(file)
  const legacy={items:JSON.stringify([{id:'legacy-candle',name:'Historical Candle',quantity:1,unitPrice:50000}]),customer:JSON.stringify({name:'Historical Fixture',email:'historical@example.com'})}
  db.prepare("INSERT INTO orders(id,receipt,amount,currency,items,customer,status) VALUES('order_legacy','legacy_receipt',50000,'INR',?,?,'paid')").run(legacy.items,legacy.customer)
  let catalog=createCatalog(db),auth=createAdminHandler({db,catalog,dataDir:folder,env:{}}).auth
  const setup=auth.bootstrap('Restart Owner','restart@example.com');await auth.accept({token:setup.token,password})
  catalog.move('jar',7,'Initial restart fixture count',setup.user.id)
  db.prepare('UPDATE studio_products SET name=? WHERE id=?').run('Persistent candle','jar')
  db.close();db=createDatabase(file);catalog=createCatalog(db);auth=createAdminHandler({db,catalog,dataDir:folder,env:{}}).auth
  try{
    assert.equal(catalog.lookup('jar').stock,7)
    assert.equal(catalog.publicProducts().find(p=>p.id==='jar').name,'Persistent candle')
    assert.equal(db.prepare('SELECT count(*) n FROM studio_products').get().n,8)
    assert.equal(db.prepare('SELECT count(*) n FROM studio_migrations').get().n,1)
    assert.equal(db.prepare('SELECT customer FROM orders WHERE id=?').get('order_legacy').customer,legacy.customer)
    assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get('order_legacy').status,'paid')
    assert.equal((await auth.login({email:'restart@example.com',password})).data.user.role,'owner')
  }finally{db.close()}
})
