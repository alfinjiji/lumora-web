import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { createDatabase, createStore, StoreError } from './store.mjs'

const db = createDatabase(
  resolve(process.env.LUMORA_DATA_DIR || '.data', 'orders.sqlite'),
)
const store = createStore({ db })
const dist = resolve('dist')
const rateLimits = new Map()
const json = (response, status, data) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(data))
}
async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 32768) throw new StoreError(413, 'Request is too large.')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (pathname.startsWith('/api/')) {
      if (request.method === 'GET' && pathname === '/api/health')
        return json(response, 200, {
          status: 'ok',
          checkoutReady: store.config().checkoutReady,
        })
      if (request.method === 'GET' && pathname === '/api/store')
        return json(response, 200, store.config())
      if (request.method !== 'POST')
        return json(response, 404, { error: 'Endpoint not found.' })
      if (pathname === '/api/webhooks/razorpay')
        return json(
          response,
          200,
          store.webhook(
            await readBody(request),
            request.headers['x-razorpay-signature'],
          ),
        )
      const origin = request.headers.origin
      if (origin && new URL(origin).host !== request.headers.host)
        throw new StoreError(403, 'Use checkout from the Lumora website.')
      if (!request.headers['content-type']?.startsWith('application/json'))
        throw new StoreError(415, 'JSON body is required.')
      if (pathname === '/api/orders') {
        const ip = request.socket.remoteAddress
        const now = Date.now()
        const recent = (rateLimits.get(ip) || []).filter(
          (time) => now - time < 600000,
        )
        if (recent.length >= 20)
          throw new StoreError(429, 'Please wait before trying checkout again.')
        rateLimits.set(ip, [...recent, now])
        if (rateLimits.size > 10000)
          for (const [key, entries] of rateLimits)
            if (entries.at(-1) < now - 600000) rateLimits.delete(key)
      }
      let body
      try {
        body = JSON.parse((await readBody(request)).toString())
      } catch (error) {
        if (error instanceof StoreError) throw error
        throw new StoreError(400, 'Invalid JSON body.')
      }
      if (!body || typeof body !== 'object')
        throw new StoreError(400, 'Invalid request body.')
      if (pathname === '/api/orders')
        return json(response, 201, await store.createOrder(body))
      if (pathname === '/api/payments/verify')
        return json(response, 200, await store.verifyPayment(body))
      return json(response, 404, { error: 'Endpoint not found.' })
    }
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return json(response, 405, { error: 'Method not allowed.' })
    let file = resolve(dist, `.${decodeURIComponent(pathname)}`)
    if (!file.startsWith(`${dist}${sep}`) && file !== dist)
      return json(response, 404, { error: 'Not found.' })
    if (file === dist || !extname(file)) file = resolve(dist, 'index.html')
    if (!existsSync(file) || !statSync(file).isFile())
      return json(response, 404, {
        error: 'Not found. Run npm run build to prepare the website.',
      })
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.woff2': 'font/woff2',
    }
    response.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    })
    response.end(request.method === 'HEAD' ? undefined : readFileSync(file))
  } catch (error) {
    json(response, error instanceof StoreError ? error.status : 500, {
      error:
        error instanceof StoreError
          ? error.message
          : 'The store could not complete this request.',
    })
  }
})
server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () =>
  console.log(
    'Lumora store server ready on port',
    Number(process.env.PORT || 3001),
    '— checkout',
    store.config().checkoutReady ? 'enabled' : 'disabled',
  ),
)
const shutdown = () =>
  server.close(() => {
    db.close()
    process.exit(0)
  })
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
