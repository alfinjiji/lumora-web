import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

// Export the same React storefront as an offline, payment-disabled design review.
const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const target = resolve(process.argv[2] || 'auraflare-preview.html')
let html = readFileSync(resolve(dist, 'index.html'), 'utf8')
// Embedded font faces need no external preload requests in the offline review.
html = html.replace(/<link\b(?=[^>]*rel="preload")(?=[^>]*as="font")[^>]*>/g, '')
const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)]
if (scripts.length !== 1) throw new Error('Expected one application bundle. Run npm run build first.')
let javascript = readFileSync(resolve(dist, '.' + scripts[0][1]), 'utf8')
const sources = JSON.parse(readFileSync(resolve(dist, 'images/auraflare/SOURCES.json'), 'utf8'))
const imageHashes = new Set()
for (const source of sources.images) {
  const path = '/images/auraflare/' + source.file
  const bytes = readFileSync(resolve(dist, '.' + path))
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== source.sha256) throw new Error('Source image checksum differs: ' + path)
  if (imageHashes.has(hash)) throw new Error('Duplicate image content: ' + path)
  imageHashes.add(hash)
  javascript = javascript.replaceAll(path, 'data:image/webp;base64,' + bytes.toString('base64'))
}
const previewApi = `
const auraflareOriginalFetch=window.fetch.bind(window);
window.fetch=(input,options)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
 if(url.origin===location.origin&&url.pathname==='/api/store')return Promise.resolve(new Response(JSON.stringify({checkoutReady:false,keyId:null,shippingPaise:0,currency:'INR'}),{headers:{'Content-Type':'application/json'}}));
 if(url.origin===location.origin&&url.pathname.startsWith('/api/'))return Promise.resolve(new Response(JSON.stringify({error:'Real payments are disabled in this preview.'}),{status:503,headers:{'Content-Type':'application/json'}}));
 return auraflareOriginalFetch(input,options);
};`
html = html.replace(scripts[0][0], () => '<script>' + previewApi + '</script><script type="module">' + javascript.replaceAll('</script', '<\\/script') + '</script>')
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, (tag) => {
  const path = tag.match(/href="([^"]+)"/)?.[1]
  if (!path) throw new Error('Missing stylesheet path.')
  let css = readFileSync(resolve(dist, '.' + path), 'utf8')
  css = css.replace(/url\((['"]?)(\/fonts\/[^)'"\s]+)\1\)/g, (_, _quote, fontPath) => {
    const bytes = readFileSync(resolve(dist, '.' + fontPath))
    const mime = fontPath.endsWith('.woff2') ? 'font/woff2' : 'font/ttf'
    return 'url(data:' + mime + ';base64,' + bytes.toString('base64') + ')'
  })
  return '<style>' + css + '</style>'
})
html = html.replace('/favicon.svg', 'data:image/svg+xml;base64,' + readFileSync(resolve(dist, 'favicon.svg')).toString('base64'))
let credits = readFileSync(resolve(dist, 'image-credits.html'), 'utf8').match(/<main>([\s\S]*?)<\/main>/)?.[1]
if (!credits) throw new Error('Image credits could not be embedded.')
credits = credits.replace('/images/auraflare/SOURCES.json', 'data:application/json;base64,' + Buffer.from(JSON.stringify(sources, null, 2)).toString('base64'))
credits = credits.replace(/\/fonts\/OFL-[^"\s]+\.txt/g, (fontLicense) =>
  'data:text/plain;base64,' + readFileSync(resolve(dist, '.' + fontLicense)).toString('base64'))
html = html.replace('</head>', '<style>.preview-label{position:fixed;bottom:12px;left:12px;z-index:29;background:#260b15ed;color:#ead2b6;border:1px solid #d6b99766;padding:9px 12px;font:10px/1.6 Arial,sans-serif;border-radius:5px;max-width:calc(100vw - 24px);pointer-events:none}.preview-credits{background:#260b15;padding:32px 6%;color:#ead2b6;font:12px/1.9 Arial,sans-serif}.preview-credits h1{font-size:32px;letter-spacing:0;margin:24px 0}.preview-credits h2{font-size:24px;margin:25px 0 12px}.preview-credits a{text-decoration:underline}.preview-credits summary{cursor:pointer;min-height:44px}.preview-credits table{width:100%;border-collapse:collapse}.preview-credits th,.preview-credits td{text-align:left;padding:12px;border-bottom:1px solid #d6b99744}.preview-credits p{line-height:1.8}@media(max-width:650px){.preview-credits{overflow-x:auto}.preview-label{font-size:9px}}</style></head>')
html = html.replace('</body>', () => '<div class="preview-label">Interactive preview · Demo checkout · No real payments</div><details id="preview-credits" class="preview-credits"><summary>Images &amp; font credits</summary>' + credits.replace('href="/"', 'href="#"') + '</details></body>')
writeFileSync(target, html)
console.log('Auraflare interactive preview saved: ' + target)
