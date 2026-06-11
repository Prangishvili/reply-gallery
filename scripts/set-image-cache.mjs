// One-off: set cache-control: 31536000 on every existing file in the
// `images` bucket by re-uploading identical bytes in place. URLs and
// database rows are untouched — only the cache header changes.
//
// Requires the service role key (Supabase dashboard → Project Settings → API):
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/set-image-cache.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!key) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY (anon key cannot overwrite files).')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// List all files (paginated)
const files = []
for (let page = 0; ; page++) {
  const { data, error } = await supabase.storage.from('images')
    .list('', { limit: 100, offset: page * 100 })
  if (error) { console.error('list failed:', error.message); process.exit(1) }
  files.push(...data.filter(f => f.name !== '.emptyFolderPlaceholder'))
  if (data.length < 100) break
}
console.log(`${files.length} files to update`)

const failed = []
let done = 0
for (const f of files) {
  // Skip files that already have the long cache header
  if (f.metadata?.cacheControl === 'max-age=31536000') { done++; continue }
  const { data: blob, error: dlErr } = await supabase.storage.from('images').download(f.name)
  if (dlErr) { failed.push([f.name, `download: ${dlErr.message}`]); continue }
  const { error: upErr } = await supabase.storage.from('images').update(f.name, blob, {
    contentType: f.metadata?.mimetype || 'image/webp',
    cacheControl: '31536000',
    upsert: true,
  })
  if (upErr) { failed.push([f.name, `update: ${upErr.message}`]); continue }
  done++
  if (done % 25 === 0) console.log(`  ${done}/${files.length}`)
}

console.log(`done: ${done}/${files.length} ok, ${failed.length} failed`)
failed.forEach(([name, msg]) => console.log('  FAILED', name, msg))
if (failed.length) {
  console.log('Re-run the script to retry failures (already-updated files are skipped).')
  process.exit(1)
}

// Verify: check the served header on one file
if (files.length) {
  const sample = `${url}/storage/v1/object/public/images/${files[0].name}`
  const res = await fetch(sample, { method: 'HEAD' })
  console.log('verify', files[0].name, '→ cache-control:', res.headers.get('cache-control'))
}
