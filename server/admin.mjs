import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import {
  audit,
  email,
  fail,
  integer,
  text,
  transaction,
  uid,
} from './admin-db.mjs'
import { createAuth, publicUser, digest } from './admin-auth.mjs'

const channels = ['Website', 'WhatsApp', 'Instagram', 'Phone', 'In person']
const fulfilments = [
  'Awaiting payment',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
]
const select = (value, values, label) => {
  if (!values.includes(value)) fail(400, `Check ${label}.`)
  return value
}
const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  )
export function invitationPreview(raw, user, base, purpose = 'setup') {
  const url = new URL('/admin', base)
  url.hash = 'setup=' + raw
  return {
    subject:
      purpose === 'reset'
        ? 'Reset your Auraflare password'
        : 'Your Auraflare studio invitation',
    to: user.email,
    url: url.href,
    message: `Hello ${user.name},\n\nUse this private ${purpose === 'reset' ? 'one-hour recovery' : '72-hour account setup'} link to choose your password:\n${url.href}\n\nThis link works once. No password is included. Contact your studio owner if you did not expect this invitation.`,
    sent: false,
  }
}
export function saveInvitationPreview(preview, dataDir) {
  const folder = resolve(dataDir, 'invitation-previews')
  mkdirSync(folder, { recursive: true, mode: 0o700 })
  const file = resolve(folder, uid() + '.html')
  writeFileSync(
    file,
    `<!doctype html><meta charset="utf-8"><title>${escapeHtml(preview.subject)}</title><h1>${escapeHtml(preview.subject)}</h1><p>To: ${escapeHtml(preview.to)}</p><pre style="white-space:pre-wrap">${escapeHtml(preview.message)}</pre><a href="${escapeHtml(preview.url)}">Open private setup link</a><p>Preview only. No email was sent.</p>`,
    { mode: 0o600 },
  )
  return file
}
export function createAdminHandler({
  db,
  catalog,
  dataDir,
  env = process.env,
}) {
  const auth = createAuth(db, env),
    attempts = new Map()
  const json = (res, status, data, headers = {}) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    })
    res.end(JSON.stringify(data))
  }
  const owner = (user) => {
    if (user.role !== 'owner')
      fail(403, 'Only a studio owner can make this change.')
  }
  const base = (req) =>
    env.AURAFLARE_PUBLIC_URL ||
    `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`
  const orderRows = () =>
    db
      .prepare(
        `SELECT o.*,m.channel,m.fulfilment,m.tracking,m.carrier,m.note,m.stock_state,m.manual_reference FROM orders o LEFT JOIN studio_order_meta m ON m.order_id=o.id ORDER BY o.created_at DESC,o.rowid DESC`,
      )
      .all()
      .map((o) => ({
        ...o,
        items: JSON.parse(o.items),
        customer: JSON.parse(o.customer),
        channel: o.channel || 'Website',
        fulfilment:
          o.fulfilment ||
          (o.status === 'paid' ? 'Processing' : 'Awaiting payment'),
        tracking: o.tracking || '',
        carrier: o.carrier || '',
        note: o.note || '',
        stock_state: o.stock_state || 'unreserved',
        manual_reference: o.manual_reference || '',
      }))
  const snapshot = (user) => ({
    user: publicUser(user),
    products: catalog.allProducts(),
    orders: orderRows(),
    enquiries: db
      .prepare('SELECT * FROM studio_enquiries ORDER BY rowid DESC')
      .all(),
    team:
      user.role === 'owner'
        ? db
            .prepare('SELECT * FROM studio_users ORDER BY rowid')
            .all()
            .map(publicUser)
        : db
            .prepare(
              'SELECT id,name,role,active FROM studio_users WHERE active=1',
            )
            .all(),
    content:
      user.role === 'owner'
        ? (() => {
            const c = db
              .prepare('SELECT * FROM studio_content WHERE id=1')
              .get()
            return {
              draft: JSON.parse(c.draft),
              published: JSON.parse(c.published),
              updated_at: c.updated_at,
            }
          })()
        : null,
    movements: db
      .prepare(
        'SELECT m.*,v.sku FROM studio_stock_moves m JOIN studio_variants v ON v.id=m.variant_id ORDER BY m.rowid DESC LIMIT 100',
      )
      .all(),
    activity: db
      .prepare(
        'SELECT action,detail,created_at FROM studio_audit ORDER BY rowid DESC LIMIT 20',
      )
      .all(),
    timezone: 'Asia/Kolkata',
  })
  const body = async (req) => {
    let size = 0
    const chunks = []
    for await (const chunk of req) {
      size += chunk.length
      if (size > 8 * 1024 * 1024) fail(413, 'Request is too large.')
      chunks.push(chunk)
    }
    try {
      const data = JSON.parse(Buffer.concat(chunks).toString())
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error()
      return data
    } catch {
      fail(400, 'A valid JSON object is required.')
    }
  }
  const saveProduct = (data, id, user) =>
    transaction(db, () => {
      const existing = id
        ? db.prepare('SELECT id FROM studio_products WHERE id=?').get(id)
        : null
      if (id && !existing) fail(404, 'Product not found.')
      const productId = id || 'p_' + uid(),
        name = text(data.name, 'product name', 120),
        collection = text(data.collection, 'collection', 80)
      const status = select(data.status, ['Active', 'Draft'], 'product state')
      const image = text(data.image || '', 'product image', 200, 0)
      if (
        image &&
        !/^\/(?:images\/auraflare\/[a-z-]+\.webp|media\/[a-f0-9-]+\.webp)$/.test(
          image,
        )
      )
        fail(400, 'Choose a studio product image.')
      if (status === 'Active' && !image)
        fail(400, 'Upload an image before activating this product.')
      if (
        !Array.isArray(data.category) ||
        !data.category.length ||
        data.category.some(
          (c) => !['Home', 'Gifting', 'Sculptural'].includes(c),
        )
      )
        fail(400, 'Choose at least one valid category.')
      if (
        !Array.isArray(data.variants) ||
        !data.variants.length ||
        data.variants.length > 30
      )
        fail(400, 'Add between one and 30 variants.')
      db.prepare(
        `INSERT INTO studio_products(id,name,collection,note,description,category,image,status) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,collection=excluded.collection,note=excluded.note,description=excluded.description,category=excluded.category,image=excluded.image,status=excluded.status,updated_at=CURRENT_TIMESTAMP`,
      ).run(
        productId,
        name,
        collection,
        text(data.note || '', 'scent / style notes', 200, 0),
        text(data.description || '', 'description', 3000, 0),
        JSON.stringify([...new Set(data.category)]),
        image,
        status,
      )
      const old = db
          .prepare('SELECT * FROM studio_variants WHERE product_id=?')
          .all(productId),
        ids = new Set()
      for (const [index, v] of data.variants.entries()) {
        const previous = v.id ? old.find((x) => x.id === v.id) : null
        if (v.id && !previous)
          fail(400, 'Variant does not belong to this product.')
        const vid = v.id || (!id && index === 0 ? productId : 'v_' + uid())
        if (ids.has(vid)) fail(400, 'Variants must be unique.')
        ids.add(vid)
        const sku = text(v.sku, 'SKU', 60),
          variantName = text(v.name, 'variant name', 120),
          price = integer(v.price, 'price in paise', 1, 100000000),
          stock = integer(v.stock, 'stock')
        if (
          db
            .prepare(
              'SELECT id FROM studio_variants WHERE sku=? COLLATE NOCASE AND id<>?',
            )
            .get(sku, vid)
        )
          fail(409, 'This SKU is already in use.')
        db.prepare(
          `INSERT INTO studio_variants(id,product_id,sku,name,price,stock) VALUES(?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,name=excluded.name,price=excluded.price,active=1`,
        ).run(vid, productId, sku, variantName, price)
        const delta = stock - (previous?.stock || 0)
        if (delta)
          catalog.move(
            vid,
            delta,
            text(
              data.reason || (!id ? 'Initial stock count' : ''),
              'stock adjustment reason',
              300,
              3,
            ),
            user.id,
          )
      }
      for (const v of old)
        if (!ids.has(v.id))
          db.prepare('UPDATE studio_variants SET active=0 WHERE id=?').run(v.id)
      audit(db, user.id, existing ? 'Product updated' : 'Product created', name)
      return productId
    })
  const createOrder = (data, user) =>
    transaction(db, () => {
      const channel = select(
        data.channel,
        channels.filter((c) => c !== 'Website'),
        'direct channel',
      )
      if (
        !Array.isArray(data.items) ||
        !data.items.length ||
        data.items.length > 30
      )
        fail(400, 'Add at least one order item.')
      const seen = new Set(),
        items = data.items.map((item) => {
          const v = catalog.lookup(item?.id)
          if (!v || v.status !== 'Active' || seen.has(item.id))
            fail(400, 'Choose unique active variants.')
          seen.add(item.id)
          return {
            id: v.id,
            name: v.product_name,
            variant: v.name,
            quantity: integer(item.quantity, 'quantity', 1, 99),
            unitPrice: v.price,
          }
        })
      const customer = {
        name: text(data.customer?.name, 'customer name', 100),
        email: data.customer?.email ? email(data.customer.email) : '',
        phone: text(data.customer?.phone || '', 'phone', 30, 0),
        address: text(data.customer?.address || '', 'delivery address', 500, 0),
        city: text(data.customer?.city || '', 'city', 100, 0),
        country: 'India',
      }
      const total = items.reduce((n, i) => n + i.quantity * i.unitPrice, 0)
      integer(total, 'order amount', 1, 10000000)
      const id = 'direct_' + uid(),
        receipt =
          'AF-' +
          Date.now().toString(36).toUpperCase() +
          '-' +
          uid().replaceAll('-', '').slice(0, 12).toUpperCase()
      const requestKey =
        user.id +
        ':' +
        text(data.requestId, 'order request identifier', 100, 16)
      const payloadHash = digest(
        JSON.stringify({ items, customer, channel, note: data.note || '' }),
      )
      return transaction(db, () => {
        const prior = db
          .prepare('SELECT * FROM studio_order_requests WHERE key=?')
          .get(requestKey)
        if (prior) {
          if (prior.payload_hash !== payloadHash)
            fail(
              409,
              'This request was already saved with different details. Start a new order.',
            )
          return prior.order_id
        }
        catalog.reserve(items, receipt, user.id)
        db.prepare(
          "INSERT INTO orders(id,receipt,amount,currency,items,customer) VALUES(?,?,?,'INR',?,?)",
        ).run(
          id,
          receipt,
          total,
          JSON.stringify(items),
          JSON.stringify(customer),
        )
        db.prepare(
          "INSERT INTO studio_order_meta(order_id,channel,stock_state,note) VALUES(?,?,'reserved',?)",
        ).run(id, channel, text(data.note || '', 'order note', 2000, 0))
        db.prepare(
          'INSERT INTO studio_order_requests(key,order_id,payload_hash) VALUES(?,?,?)',
        ).run(requestKey, id, payloadHash)
        audit(db, user.id, 'Direct order created', receipt)
        return id
      })
    })
  return {
    auth,
    snapshot,
    async handle(req, res, pathname) {
      const method = req.method,
        path = pathname.slice('/api/admin'.length) || '/',
        user = auth.session(req)
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
        return json(res, 405, { error: 'Method not allowed.' })
      if (method !== 'GET') {
        if (
          req.headers['x-auraflare-request'] !== 'admin' ||
          !req.headers['content-type']?.startsWith('application/json')
        )
          fail(403, 'Use the secure studio application for this request.')
        const origin = req.headers.origin
        if (origin && origin !== new URL(base(req)).origin)
          fail(403, 'Request origin is not allowed.')
        if (
          user &&
          !['/login', '/accept-invitation'].includes(path) &&
          req.headers['x-csrf-token'] !== user.csrf
        )
          fail(403, 'Your security token has expired. Reload and try again.')
      }
      if (method === 'GET' && path === '/session')
        return json(
          res,
          200,
          user ? { user: publicUser(user), csrf: user.csrf } : { user: null },
        )
      if (
        method === 'POST' &&
        ['/login', '/accept-invitation'].includes(path)
      ) {
        const key = req.socket.remoteAddress || 'unknown',
          now = Date.now(),
          recent = (attempts.get(key) || []).filter((t) => t > now - 15 * 60000)
        if (recent.length >= 15)
          fail(429, 'Too many attempts. Try again in 15 minutes.')
        if (attempts.size > 10000)
          for (const [k, times] of attempts)
            if (times.at(-1) < now - 15 * 60000) attempts.delete(k)
        attempts.set(key, [...recent, now])
        const data = await body(req)
        const result =
          path === '/login' ? await auth.login(data) : await auth.accept(data)
        attempts.delete(key)
        audit(db, result.data.user.id, 'Signed in', 'Studio session created')
        return json(res, 200, result.data, { 'Set-Cookie': result.cookie })
      }
      if (!user) fail(401, 'Sign in to your studio account.')
      if (method === 'POST' && path === '/logout')
        return json(res, 200, { ok: true }, { 'Set-Cookie': auth.logout(user) })
      if (method === 'GET' && path === '/snapshot')
        return json(res, 200, snapshot(user))
      if (method === 'GET' && path.startsWith('/avatar/')) {
        const member = db
          .prepare('SELECT avatar FROM studio_users WHERE id=?')
          .get(path.slice(8))
        if (!member?.avatar) fail(404, 'Photo not found.')
        const bytes = readFileSync(resolve(dataDir, 'avatars', member.avatar))
        res.writeHead(200, {
          'Content-Type': 'image/webp',
          'Cache-Control': 'private, no-cache',
          'X-Content-Type-Options': 'nosniff',
        })
        return res.end(bytes)
      }
      const data = method === 'GET' ? {} : await body(req)
      if (method === 'PUT' && path === '/profile') {
        db.prepare(
          'UPDATE studio_users SET name=?,phone=?,bio=? WHERE id=?',
        ).run(
          text(data.name, 'display name', 100),
          text(data.phone || '', 'phone number', 30, 0),
          text(data.bio || '', 'bio', 500, 0),
          user.id,
        )
        audit(db, user.id, 'Profile updated', 'Personal details saved')
      } else if (method === 'POST' && path === '/password') {
        const expired = await auth.password(user, data)
        return json(res, 200, { ok: true }, { 'Set-Cookie': expired })
      } else if (method === 'POST' && path === '/upload') {
        const kind = select(
          data.kind,
          ['avatar', 'product', 'banner'],
          'image purpose',
        )
        if (kind !== 'avatar') owner(user)
        if (
          typeof data.image !== 'string' ||
          !/^data:image\/(?:png|jpeg|webp);base64,/.test(data.image)
        )
          fail(400, 'Choose a PNG, JPEG or WebP image.')
        const raw = Buffer.from(data.image.split(',')[1], 'base64'),
          limit = kind === 'avatar' ? 2 : 5
        if (!raw.length || raw.length > limit * 1024 * 1024)
          fail(413, `Image must be under ${limit} MB.`)
        let output
        try {
          const image = sharp(raw, {
            limitInputPixels: 20000000,
            animated: false,
          })
          const meta = await image.metadata()
          if (!['png', 'jpeg', 'webp'].includes(meta.format) || meta.pages > 1)
            throw new Error()
          output = await image
            .rotate()
            .resize(
              kind === 'avatar' ? 256 : 1600,
              kind === 'avatar' ? 256 : 1600,
              { fit: 'inside', withoutEnlargement: true },
            )
            .webp({ quality: 85 })
            .toBuffer()
        } catch {
          fail(
            400,
            'This image cannot be decoded. Use a valid, still PNG, JPEG or WebP.',
          )
        }
        const file = uid() + '.webp',
          folder = resolve(dataDir, kind === 'avatar' ? 'avatars' : 'media')
        mkdirSync(folder, { recursive: true, mode: 0o700 })
        writeFileSync(resolve(folder, file), output, { mode: 0o600 })
        if (kind === 'avatar') {
          const old=db.prepare('SELECT avatar FROM studio_users WHERE id=?').get(user.id).avatar
          db.prepare('UPDATE studio_users SET avatar=? WHERE id=?').run(file,user.id)
          if(old)rmSync(resolve(dataDir,'avatars',old),{force:true})
        }
        audit(db, user.id, 'Image uploaded', kind)
        return json(res, 200, {
          url:
            kind === 'avatar'
              ? `/api/admin/avatar/${user.id}?v=${Date.now()}`
              : '/media/' + file,
        })
      } else if (method === 'DELETE' && path === '/avatar') {
        if(user.avatar)rmSync(resolve(dataDir,'avatars',user.avatar),{force:true})
        db.prepare("UPDATE studio_users SET avatar='' WHERE id=?").run(user.id)
        audit(db, user.id, 'Profile photo removed', 'Avatar cleared')
      } else if (method === 'POST' && path === '/products') {
        owner(user)
        saveProduct(data, null, user)
      } else if (method === 'PUT' && path.startsWith('/products/')) {
        owner(user)
        saveProduct(data, path.slice(10), user)
      } else if (method === 'POST' && path === '/inventory') {
        const delta = integer(data.delta, 'stock adjustment', -1000000, 1000000)
        if (!delta) fail(400, 'Enter a non-zero adjustment.')
        transaction(db, () => {
          catalog.move(
            text(data.variantId, 'variant', 100),
            delta,
            text(data.reason, 'adjustment reason', 300, 3),
            user.id,
          )
          audit(db, user.id, 'Stock adjusted', data.reason)
        })
      } else if (method === 'POST' && path === '/orders') {
        createOrder(data, user)
      } else if (method === 'PATCH' && /^\/orders\/[^/]+$/.test(path)) {
        transaction(db, () => {
          const id = path.slice(8),
            order = orderRows().find((o) => o.id === id)
          if (!order) fail(404, 'Order not found.')
          const next = select(data.fulfilment, fulfilments, 'fulfilment state'),
            current = order.fulfilment
          const transitions = {
            'Awaiting payment': ['Processing', 'Cancelled'],
            Processing: ['Shipped', 'Cancelled'],
            Shipped: ['Delivered'],
            Delivered: [],
            Cancelled: [],
          }
          if (next !== current && !transitions[current]?.includes(next))
            fail(409, 'This order transition is not allowed.')
          if (
            ['Processing', 'Shipped', 'Delivered'].includes(next) &&
            order.status !== 'paid'
          )
            fail(
              409,
              'Confirm payment before preparing or shipping this order.',
            )
          const tracking = text(
              data.tracking || '',
              'tracking reference',
              200,
              0,
            ),
            carrier = text(data.carrier || '', 'carrier', 100, 0)
          if (next === 'Shipped' && (!tracking || !carrier))
            fail(
              400,
              'Add the carrier and tracking reference before recording shipment.',
            )
          if (
            next !== 'Cancelled' &&
            order.stock_state !== 'reserved' &&
            ['Processing', 'Shipped'].includes(next)
          )
            catalog.reserve(order.items, order.receipt, user.id)
          if (next === 'Cancelled' && order.stock_state === 'reserved')
            catalog.release(order.receipt, user.id)
          transaction(db, () => {
            db.prepare(
              `INSERT INTO studio_order_meta(order_id,channel,fulfilment,tracking,carrier,note,stock_state) VALUES(?,?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET fulfilment=excluded.fulfilment,tracking=excluded.tracking,carrier=excluded.carrier,note=excluded.note,stock_state=excluded.stock_state`,
            ).run(
              id,
              order.channel,
              next,
              tracking,
              carrier,
              text(data.note || '', 'order note', 2000, 0),
              next === 'Cancelled'
                ? 'released'
                : ['Processing', 'Shipped', 'Delivered'].includes(next)
                  ? 'reserved'
                  : order.stock_state,
            )
            audit(db, user.id, 'Order updated', order.receipt + ' · ' + next)
          })
        })
      } else if (method === 'POST' && /^\/orders\/[^/]+\/payment$/.test(path)) {
        transaction(db, () => {
          owner(user)
          const id = path.split('/')[2],
            order = orderRows().find((o) => o.id === id)
          if (!order) fail(404, 'Order not found.')
          if (order.channel === 'Website')
            fail(
              403,
              'Website payments can only be confirmed by verified Razorpay callbacks.',
            )
          if (order.status === 'paid' || order.fulfilment === 'Cancelled')
            fail(409, 'This order cannot receive another payment record.')
          if (data.amount !== order.amount)
            fail(400, 'The recorded amount must equal the order total.')
          const reference = text(
            data.reference,
            'cash / bank receipt reference',
            200,
            4,
          )
          transaction(db, () => {
            db.prepare(
              "UPDATE orders SET status='paid',payment_id=? WHERE id=?",
            ).run('manual:' + uid(), id)
            db.prepare(
              'UPDATE studio_order_meta SET manual_reference=? WHERE order_id=?',
            ).run(reference, id)
            audit(
              db,
              user.id,
              'Direct payment receipt recorded',
              order.receipt + ' · ' + reference,
            )
          })
        })
      } else if (method === 'POST' && path === '/enquiries') {
        const assigned = data.assigned_to || null
        if (
          assigned &&
          !db
            .prepare('SELECT id FROM studio_users WHERE id=? AND active=1')
            .get(assigned)
        )
          fail(400, 'Choose an active assignee.')
        db.prepare(
          'INSERT INTO studio_enquiries(id,name,email,phone,subject,channel,message,assigned_to) VALUES(?,?,?,?,?,?,?,?)',
        ).run(
          uid(),
          text(data.name, 'contact name', 100),
          data.email ? email(data.email) : '',
          text(data.phone || '', 'phone', 30, 0),
          text(data.subject, 'subject', 200),
          select(data.channel, channels, 'channel'),
          text(data.message, 'message', 5000),
          assigned,
        )
        audit(db, user.id, 'Enquiry added', 'Internal record; no message sent')
      } else if (method === 'PUT' && path.startsWith('/enquiries/')) {
        const assigned = data.assigned_to || null
        if (
          assigned &&
          !db
            .prepare('SELECT id FROM studio_users WHERE id=? AND active=1')
            .get(assigned)
        )
          fail(400, 'Choose an active assignee.')
        const result = db
          .prepare(
            'UPDATE studio_enquiries SET status=?,notes=?,assigned_to=? WHERE id=?',
          )
          .run(
            select(
              data.status,
              ['New', 'In progress', 'Resolved'],
              'enquiry state',
            ),
            text(data.notes || '', 'internal notes', 5000, 0),
            assigned,
            path.slice(11),
          )
        if (!result.changes) fail(404, 'Enquiry not found.')
        audit(
          db,
          user.id,
          'Enquiry updated',
          'Internal notes / follow-up state',
        )
      } else if (method === 'PUT' && path === '/content') {
        owner(user)
        const content = {
          headline: text(data.headline, 'headline', 240),
          subtitle: text(data.subtitle, 'subtitle', 800),
          announcement: text(data.announcement || '', 'announcement', 200, 0),
          button: text(data.button, 'button label', 80),
          featured: select(
            data.featured,
            ['All', 'Home', 'Gifting', 'Sculptural'],
            'featured collection',
          ),
          image: text(data.image, 'hero image', 200),
        }
        if (
          !/^\/(?:images\/auraflare\/[a-z-]+\.webp|media\/[a-f0-9-]+\.webp)$/.test(
            content.image,
          )
        )
          fail(400, 'Choose a studio campaign image.')
        db.prepare(
          `UPDATE studio_content SET draft=?,${data.publish === true ? 'published=?,' : ''}updated_at=CURRENT_TIMESTAMP WHERE id=1`,
        ).run(
          ...(data.publish === true
            ? [JSON.stringify(content), JSON.stringify(content)]
            : [JSON.stringify(content)]),
        )
        audit(
          db,
          user.id,
          data.publish === true
            ? 'Website content published'
            : 'Content draft saved',
          content.headline,
        )
      } else if (method === 'POST' && path === '/team') {
        owner(user)
        const identifier = email(data.email)
        if (
          db
            .prepare('SELECT id FROM studio_users WHERE email=? COLLATE NOCASE')
            .get(identifier)
        )
          fail(409, 'An account with this email already exists.')
        const member = {
            id: uid(),
            email: identifier,
            name: text(data.name, 'member name', 100),
          },
          role = select(data.role, ['owner', 'staff'], 'role')
        const raw = transaction(db, () => {
          db.prepare(
            'INSERT INTO studio_users(id,email,name,role) VALUES(?,?,?,?)',
          ).run(member.id, identifier, member.name, role)
          audit(db, user.id, 'Team invitation created', identifier)
          return auth.invite(member)
        })
        const preview = invitationPreview(raw, member, base(req))
        saveInvitationPreview(preview, dataDir)
        return json(res, 201, { preview })
      } else if (method === 'PUT' && path.startsWith('/team/')) {
        owner(user)
        const id = path.slice(6),
          member = db.prepare('SELECT * FROM studio_users WHERE id=?').get(id)
        if (!member) fail(404, 'Member not found.')
        if(typeof data.active!=='boolean')fail(400,'Check account access state.')
        const role = select(data.role, ['owner', 'staff'], 'role'),
          active = data.active === true ? 1 : 0
        transaction(db, () => {
          if (
            member.role === 'owner' &&
            member.active &&
            (!active || role !== 'owner') &&
            db
              .prepare(
                "SELECT count(*) AS n FROM studio_users WHERE role='owner' AND active=1 AND password_hash IS NOT NULL",
              )
              .get().n <= 1
          )
            fail(409, 'Keep at least one active owner.')
          db.prepare(
            'UPDATE studio_users SET name=?,role=?,active=? WHERE id=?',
          ).run(text(data.name, 'member name', 100), role, active, id)
          if (!active) {
            db.prepare('DELETE FROM studio_sessions WHERE user_id=?').run(id)
            db.prepare('DELETE FROM studio_tokens WHERE user_id=?').run(id)
          }
          audit(db, user.id, 'Team access updated', member.email)
        })
      } else if (
        method === 'POST' &&
        /^\/team\/[^/]+\/invitation$/.test(path)
      ) {
        owner(user)
        const member = db
          .prepare('SELECT * FROM studio_users WHERE id=? AND active=1')
          .get(path.split('/')[2])
        if (!member) fail(404, 'Active member not found.')
        const purpose = member.password_hash ? 'reset' : 'setup',
          raw = auth.invite(member, purpose),
          preview = invitationPreview(raw, member, base(req), purpose)
        saveInvitationPreview(preview, dataDir)
        audit(
          db,
          user.id,
          'Account setup / recovery link created',
          member.email,
        )
        return json(res, 200, { preview })
      } else return json(res, 404, { error: 'Admin endpoint not found.' })
      return json(res, 200, { ok: true })
    },
  }
}
