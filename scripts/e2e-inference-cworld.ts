// Manual e2e probe: run real requests against cworld-be and print the
// inferred schemas the engine produces. Not a test — just for human eyeballing.
//
// Usage:  pnpm tsx scripts/e2e-inference-cworld.ts
import { captureFromResult } from '../packages/shared/src/inference/index.js'

const BASE = process.env.CWORLD_BASE ?? 'http://127.0.0.1:4000'

async function callJson(path: string): Promise<{ httpStatus: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`)
  const text = await res.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = text }
  return { httpStatus: res.status, body }
}

function box(title: string): void {
  console.log(`\n┌─ ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`)
}

console.log(`\nTarget: ${BASE}\n`)

// /api/health — twice
box('GET /api/health  (run 1)')
const h1 = await callJson('/api/health')
console.log('  body:', JSON.stringify(h1.body))
let cap = captureFromResult(undefined, h1)!
console.log('  family:', cap.observation.family, ' runs:', cap.next.runs)

box('GET /api/health  (run 2)')
const h2 = await callJson('/api/health')
console.log('  body:', JSON.stringify(h2.body))
cap = captureFromResult(cap.next, h2)!
console.log('  family:', cap.observation.family, ' runs:', cap.next.runs)
console.log('  drift:', cap.drift)
console.log('  schema 2xx:')
console.log('   ', JSON.stringify(cap.next.schemas['2xx'], null, 2).replace(/\n/g, '\n    '))

// /api/health/welcome
box('GET /api/health/welcome')
const w = await callJson('/api/health/welcome')
console.log('  body:', JSON.stringify(w.body))
const capW = captureFromResult(undefined, w)!
console.log('  schema 2xx (after redaction):')
console.log('   ', JSON.stringify(capW.next.schemas['2xx'], null, 2).replace(/\n/g, '\n    '))
console.log('  example (after redaction):')
console.log('   ', JSON.stringify(capW.next.examples['2xx']))

// /api/v1/nakama/profile (no auth → error)
box('GET /api/v1/nakama/profile  (no auth)')
const p = await callJson('/api/v1/nakama/profile')
console.log('  http:', p.httpStatus, ' body:', JSON.stringify(p.body))
const capP = captureFromResult(cap.next, p)!
console.log('  family:', capP.observation.family)
console.log('  schemas keys:', Object.keys(capP.next.schemas))
console.log(`  schema ${capP.observation.family}:`)
console.log('   ', JSON.stringify(capP.next.schemas[capP.observation.family], null, 2).replace(/\n/g, '\n    '))

// Verify 2xx still untouched
box('Cross-check: 2xx schema after the 5xx capture')
console.log('   2xx still object?', (capP.next.schemas['2xx'] as { type: string }).type)
console.log('   2xx required:', (capP.next.schemas['2xx'] as { required: string[] }).required)

console.log('\n✓ done\n')
