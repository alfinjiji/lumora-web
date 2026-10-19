import { randomUUID } from 'node:crypto'
import { products } from '../src/products.ts'
import { StoreError } from './store.mjs'

export const uid = () => randomUUID()
export const fail = (status, message) => {
  throw new StoreError(status, message)
}
export function transaction(db, fn) {
  if (db.isTransaction) return fn()
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
export function text(value, label, max = 200, min = 1) {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `Check ${label}.`)
  return value.trim()
}
export function email(value) {
  const result = text(value, 'email address', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    fail(400, 'Enter a valid email address.')
  return result
}
export function integer(value, label, min = 0, max = 1000000) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail(400, `Check ${label}.`)
  return value
}
export function migrateAdmin(db) {
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS studio_migrations (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);`)
  if (db.prepare('SELECT version FROM studio_migrations WHERE version=1').get())
    return
  transaction(db, () => {
    db.exec(`
      CREATE TABLE studio_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','staff')), active INTEGER NOT NULL DEFAULT 1,
        password_hash TEXT, phone TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE studio_sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES studio_users(id), csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE studio_tokens (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES studio_users(id), purpose TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE studio_products (id TEXT PRIMARY KEY, name TEXT NOT NULL, collection TEXT NOT NULL, note TEXT NOT NULL,
        description TEXT NOT NULL, category TEXT NOT NULL, image TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('Active','Draft')),
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE studio_variants (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES studio_products(id),
        sku TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>0),
        stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE studio_stock_moves (id TEXT PRIMARY KEY, variant_id TEXT NOT NULL REFERENCES studio_variants(id),
        delta INTEGER NOT NULL, stock_after INTEGER NOT NULL, reason TEXT NOT NULL, actor TEXT, reference_order TEXT,
        kind TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(variant_id, reference_order, kind));
      CREATE TABLE studio_order_meta (order_id TEXT PRIMARY KEY REFERENCES orders(id), channel TEXT NOT NULL,
        fulfilment TEXT NOT NULL DEFAULT 'Awaiting payment', tracking TEXT NOT NULL DEFAULT '', carrier TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '', stock_state TEXT NOT NULL DEFAULT 'unreserved', manual_reference TEXT NOT NULL DEFAULT '');
      CREATE TABLE studio_order_requests (key TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), payload_hash TEXT NOT NULL);
      CREATE TABLE studio_enquiries (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL, channel TEXT NOT NULL, message TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'New', assigned_to TEXT REFERENCES studio_users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE studio_content (id INTEGER PRIMARY KEY CHECK(id=1), draft TEXT NOT NULL, published TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE studio_audit (id TEXT PRIMARY KEY, actor TEXT, action TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO studio_migrations(version) VALUES(1);
    `)
    const insert = db.prepare(
      'INSERT INTO studio_products(id,name,collection,note,description,category,image,status) VALUES(?,?,?,?,?,?,?,?)',
    )
    const variant = db.prepare(
      'INSERT INTO studio_variants(id,product_id,sku,name,price,stock) VALUES(?,?,?,?,?,0)',
    )
    for (const product of products) {
      insert.run(
        product.id,
        product.name,
        'The Candle Edit',
        product.note,
        product.description,
        JSON.stringify(product.category),
        product.image,
        'Active',
      )
      variant.run(
        product.id,
        product.id,
        'AUR-' + product.id.toUpperCase(),
        product.note,
        product.price * 100,
      )
    }
    const initial = JSON.stringify({
      headline: 'A little light. A slower moment.',
      subtitle:
        'Candles for quiet evenings, thoughtful gifts, and the moments you want to hold onto.',
      announcement: 'A LITTLE LIGHT. A LITTLE LESS HURRY.',
      button: 'Find your glow',
      image: '/images/auraflare/hero.webp',
      featured: 'All',
    })
    db.prepare(
      'INSERT INTO studio_content(id,draft,published) VALUES(1,?,?)',
    ).run(initial, initial)
  })
}
export function audit(db, actor, action, detail) {
  db.prepare(
    'INSERT INTO studio_audit(id,actor,action,detail) VALUES(?,?,?,?)',
  ).run(uid(), actor || null, action, detail)
}
export function createCatalog(db) {
  migrateAdmin(db)
  const variants = (id) =>
    db
      .prepare(
        'SELECT * FROM studio_variants WHERE product_id=? AND active=1 ORDER BY rowid',
      )
      .all(id)
  const allProducts = () =>
    db
      .prepare('SELECT * FROM studio_products ORDER BY rowid')
      .all()
      .map((p) => ({
        ...p,
        category: JSON.parse(p.category),
        price: variants(p.id)[0]?.price || 0,
        stock: variants(p.id).reduce((n, v) => n + v.stock, 0),
        variants: variants(p.id),
      }))
  const lookup = (id) => {
    if (typeof id !== 'string' || id.length > 100) return undefined
    return db
      .prepare(
        `SELECT v.*,p.name AS product_name,p.image,p.status,p.note FROM studio_variants v JOIN studio_products p ON p.id=v.product_id WHERE v.id=? AND v.active=1`,
      )
      .get(id)
  }
  const move = (
    id,
    delta,
    reason,
    actor = null,
    reference = null,
    kind = 'adjust',
  ) => {
    const variant = db
      .prepare('SELECT * FROM studio_variants WHERE id=?')
      .get(id)
    if (!variant) fail(404, 'Variant not found.')
    const next = variant.stock + delta
    integer(next, 'available stock')
    db.prepare('UPDATE studio_variants SET stock=? WHERE id=?').run(next, id)
    db.prepare(
      'INSERT INTO studio_stock_moves(id,variant_id,delta,stock_after,reason,actor,reference_order,kind) VALUES(?,?,?,?,?,?,?,?)',
    ).run(uid(), id, delta, next, reason, actor, reference, kind)
  }
  const reserve = (items, reference, actor = null) =>
    transaction(db, () => {
      for (const item of items) {
        const v = lookup(item.id)
        if (!v || v.status !== 'Active' || v.stock < item.quantity)
          fail(
            409,
            'Insufficient stock. Check available quantities before ordering.',
          )
        move(
          item.id,
          -item.quantity,
          'Order reservation',
          actor,
          reference,
          'reserve',
        )
      }
    })
  const release = (reference, actor = null) =>
    transaction(db, () => {
      for (const m of db
        .prepare(
          "SELECT * FROM studio_stock_moves WHERE reference_order=? AND kind='reserve'",
        )
        .all(reference)) {
        if (
          !db
            .prepare(
              "SELECT id FROM studio_stock_moves WHERE reference_order=? AND variant_id=? AND kind='release'",
            )
            .get(reference, m.variant_id)
        )
          move(
            m.variant_id,
            -m.delta,
            'Order cancelled / reservation released',
            actor,
            reference,
            'release',
          )
      }
    })
  return {
    allProducts,
    persistOrder: (write) => transaction(db, write),
    lookup,
    move,
    reserve,
    release,
    publicProducts: () =>
      allProducts()
        .filter((p) => p.status === 'Active' && p.variants.length)
        .map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price / 100,
          image: p.image,
          category: p.category,
          tag: products.find(seed => seed.id === p.id)?.tag || p.collection,
          note: p.note,
          description: p.description,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: v.price / 100,
            stock: v.stock,
          })),
        })),
    attachOrder: (id) =>
      db
        .prepare(
          "INSERT INTO studio_order_meta(order_id,channel,stock_state) VALUES(?,'Website','reserved')",
        )
        .run(id),
    published: () =>
      JSON.parse(
        db.prepare('SELECT published FROM studio_content WHERE id=1').get()
          .published,
      ),
  }
}
