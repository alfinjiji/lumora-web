import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

// A self-contained, interactive design review. This never enables payments.
const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const target = resolve(process.argv[2] || 'lumora-preview.html')
let html = readFileSync(resolve(dist, 'index.html'), 'utf8')
const scripts = [
  ...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g),
]
if (scripts.length !== 1) {
  throw new Error(
    'Expected one bundled application script. Run npm run build first.',
  )
}
let javascript = readFileSync(resolve(dist, `.${scripts[0][1]}`), 'utf8')
const photographs = JSON.parse(
  readFileSync(resolve(dist, 'images/photography/SOURCES.json'), 'utf8'),
)
const imageHashes = new Set()
for (const path of [
  '/images/after-dark-story.webp',
  ...photographs.images.map((image) => `/images/photography/${image.file}`),
]) {
  const bytes = readFileSync(resolve(dist, `.${path}`))
  const digest = createHash('sha256').update(bytes).digest('hex')
  const source = photographs.images.find((image) =>
    path.endsWith(`/${image.file}`),
  )
  if (source && digest !== source.sha256)
    throw new Error(`Image checksum differs: ${path}`)
  if (imageHashes.has(digest))
    throw new Error(`Duplicate image content: ${path}`)
  imageHashes.add(digest)
  const mime = path.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  javascript = javascript.replaceAll(
    path,
    `data:${mime};base64,${bytes.toString('base64')}`,
  )
}
javascript = javascript.replaceAll('/image-credits.html', '#preview-credits')
const previewApi = `
const lumoraOriginalFetch = window.fetch.bind(window);
window.fetch = (input, options) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === '/api/store') return Promise.resolve(new Response(JSON.stringify({checkoutReady:false}), {headers:{'Content-Type':'application/json'}}));
  if (url?.startsWith('/api/')) return Promise.resolve(new Response(JSON.stringify({error:'Payments are disabled in this design preview.'}), {status:503,headers:{'Content-Type':'application/json'}}));
  return lumoraOriginalFetch(input, options);
};`
html = html.replace(
  scripts[0][0],
  () =>
    `<script>${previewApi}</script><script type="module">${javascript.replaceAll('</script', '<\\/script')}</script>`,
)
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, (tag) => {
  const path = tag.match(/href="([^"]+)"/)?.[1]
  if (!path) throw new Error('Stylesheet path is missing.')
  return `<style>${readFileSync(resolve(dist, `.${path}`), 'utf8')}</style>`
})
const favicon = readFileSync(resolve(dist, 'favicon.svg')).toString('base64')
html = html.replace('/favicon.svg', `data:image/svg+xml;base64,${favicon}`)
let credits = readFileSync(resolve(dist, 'image-credits.html'), 'utf8').match(
  /<main>([\s\S]*?)<\/main>/,
)?.[1]
if (!credits) throw new Error('Image credits could not be embedded.')
const sourceDownload = Buffer.from(
  JSON.stringify(photographs, null, 2),
).toString('base64')
credits = credits.replace(
  'href="/images/photography/SOURCES.json"',
  `href="data:application/json;base64,${sourceDownload}" download="lumora-photo-sources.json"`,
)
html = html.replace(
  '</head>',
  `<style>.preview-label{position:fixed;bottom:12px;left:12px;z-index:29;background:#18120fe8;color:#dcc3a0;border:1px solid #99774d66;padding:9px 12px;font:10px/1.6 Arial,sans-serif;border-radius:3px;max-width:calc(100vw - 24px);pointer-events:none}.preview-credits{background:#17130f;padding:40px 7%;color:#cfb89a;font:12px/1.9 Arial,sans-serif}.preview-credits h1{font-size:38px;margin:25px 0}.preview-credits h2{font-size:24px;margin:25px 0 12px}.preview-credits a{text-decoration:underline}.preview-credits summary{cursor:pointer;min-height:44px}.preview-credits table{width:100%;border-collapse:collapse}.preview-credits td,.preview-credits th{text-align:left;padding:12px;border-bottom:1px solid #99774d44}@media(max-width:760px){.preview-credits{overflow-x:auto}.preview-label{font-size:9px}}</style></head>`,
)
html = html.replace(
  '</body>',
  () =>
    `<div class="preview-label">Interactive design review · Sample catalog · Payments disabled</div><details id="preview-credits" class="preview-credits"><summary>Photography &amp; image credits</summary>${credits.replace('href="/"', 'href="#"')}</details></body>`,
)
writeFileSync(target, html)
console.log(`Interactive preview saved: ${target}`)
