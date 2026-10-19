import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'
import { audit, email, fail, text, transaction, uid } from './admin-db.mjs'
const scrypt = promisify(scryptCallback)
export const digest = (value) =>
  createHash('sha256').update(value).digest('hex')
const token = () => randomBytes(32).toString('base64url')
export const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  active: Boolean(u.active),
  phone: u.phone,
  bio: u.bio,
  avatar: u.avatar,
  invited: !u.password_hash,
})
export async function hashPassword(value) {
  if (
    typeof value !== 'string' ||
    value.length > 128 ||
    value.trim().length < 12
  )
    fail(400, 'Use a password of 12–128 characters.')
  const password = value
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64, {
    N: 65536,
    r: 8,
    p: 2,
    maxmem: 128 * 1024 * 1024,
  })
  return `scrypt:${salt}:${hash.toString('hex')}`
}
export async function checkPassword(value, stored) {
  if (typeof value !== 'string' || value.length > 128) return false
  const [, salt, encoded] = (stored || 'scrypt:unavailable:').split(':')
  const actual = await scrypt(value, salt, 64, {
    N: 65536,
    r: 8,
    p: 2,
    maxmem: 128 * 1024 * 1024,
  })
  const expected = Buffer.from(encoded || '0'.repeat(128), 'hex')
  return (
    expected.length === actual.length &&
    timingSafeEqual(expected, actual) &&
    Boolean(stored)
  )
}
export function createAuth(db, env = process.env) {
  const secure =
    env.AURAFLARE_PUBLIC_URL?.startsWith('https://') ||
    env.NODE_ENV === 'production'
  const cookie = (value, age) =>
    `auraflare_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`
  const session = (request) => {
    const raw = request.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('auraflare_session='))
      ?.split('=')[1]
    if (!raw || raw.length > 100) return null
    return (
      db
        .prepare(
          `SELECT u.*,s.csrf,s.hash AS session_hash FROM studio_sessions s JOIN studio_users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>? AND u.active=1 AND u.password_hash IS NOT NULL`,
        )
        .get(digest(raw), Date.now()) || null
    )
  }
  const signIn = (user) => {
    const raw = token(),
      csrf = token()
    db.prepare('DELETE FROM studio_sessions WHERE expires<?').run(Date.now())
    db.prepare(
      'INSERT INTO studio_sessions(hash,user_id,csrf,expires) VALUES(?,?,?,?)',
    ).run(digest(raw), user.id, csrf, Date.now() + 12 * 60 * 60 * 1000)
    return {
      cookie: cookie(raw, 12 * 60 * 60),
      data: { user: publicUser(user), csrf },
    }
  }
  const invite = (user, purpose = 'setup') => {
    const raw = token()
    db.prepare('DELETE FROM studio_tokens WHERE user_id=?').run(user.id)
    db.prepare(
      'INSERT INTO studio_tokens(hash,user_id,purpose,expires) VALUES(?,?,?,?)',
    ).run(
      digest(raw),
      user.id,
      purpose,
      Date.now() + (purpose === 'reset' ? 3600000 : 72 * 3600000),
    )
    return raw
  }
  return {
    session,
    signIn,
    invite,
    logout: (user) => {
      if (user)
        db.prepare('DELETE FROM studio_sessions WHERE hash=?').run(
          user.session_hash,
        )
      return cookie('', 0)
    },
    async login(body) {
      const identifier = email(body.email)
      const user = db
        .prepare('SELECT * FROM studio_users WHERE email=? COLLATE NOCASE')
        .get(identifier)
      const valid = await checkPassword(body.password, user?.password_hash)
      const fresh =
        user && db.prepare('SELECT * FROM studio_users WHERE id=?').get(user.id)
      if (
        !valid ||
        !fresh?.active ||
        fresh.password_hash !== user.password_hash
      )
        fail(401, 'Email or password is incorrect.')
      return signIn(fresh)
    },
    async accept(body) {
      const raw = text(body.token, 'setup link', 100, 32)
      const entry = db
        .prepare(
          'SELECT t.*,u.active FROM studio_tokens t JOIN studio_users u ON u.id=t.user_id WHERE t.hash=? AND t.expires>?',
        )
        .get(digest(raw), Date.now())
      if (!entry?.active)
        fail(
          400,
          'This setup link is invalid or expired. Ask the owner for a new link.',
        )
      const passwordHash = await hashPassword(body.password)
      transaction(db, () => {
        const current = db
          .prepare('SELECT * FROM studio_tokens WHERE hash=? AND expires>?')
          .get(digest(raw), Date.now())
        if (!current) fail(400, 'This setup link has already been used.')
        db.prepare('UPDATE studio_users SET password_hash=? WHERE id=?').run(
          passwordHash,
          entry.user_id,
        )
        db.prepare('DELETE FROM studio_tokens WHERE user_id=?').run(
          entry.user_id,
        )
        db.prepare('DELETE FROM studio_sessions WHERE user_id=?').run(
          entry.user_id,
        )
        audit(db, entry.user_id, 'Account setup completed', entry.purpose)
      })
      return signIn(
        db.prepare('SELECT * FROM studio_users WHERE id=?').get(entry.user_id),
      )
    },
    async password(user, body) {
      if (!(await checkPassword(body.currentPassword, user.password_hash)))
        fail(400, 'Current password is incorrect.')
      const newHash = await hashPassword(body.password)
      transaction(db, () => {
        const current = db
          .prepare('SELECT * FROM studio_users WHERE id=?')
          .get(user.id)
        if (!current?.active || current.password_hash !== user.password_hash)
          fail(401, 'Sign in again before changing this password.')
        db.prepare('UPDATE studio_users SET password_hash=? WHERE id=?').run(
          newHash,
          user.id,
        )
        db.prepare('DELETE FROM studio_sessions WHERE user_id=?').run(user.id)
        db.prepare('DELETE FROM studio_tokens WHERE user_id=?').run(user.id)
        audit(db, user.id, 'Password changed', 'All sessions revoked')
      })
      return cookie('', 0)
    },
    bootstrap(name, identifier) {
      return transaction(db, () => {
        if (db.prepare('SELECT id FROM studio_users LIMIT 1').get())
          fail(
            409,
            'An account already exists. Use an owner invitation or recovery command.',
          )
        const user = {
          id: uid(),
          name: text(name, 'name', 100),
          email: email(identifier),
        }
        db.prepare(
          "INSERT INTO studio_users(id,name,email,role) VALUES(?,?,?,'owner')",
        ).run(user.id, user.name, user.email)
        return { user, token: invite(user) }
      })
    },
  }
}
