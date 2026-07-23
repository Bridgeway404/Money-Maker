#!/usr/bin/env node
// Read-only verification that seeding is idempotent: after any number of
// `npm run db:seed` runs there must be exactly 21 option contracts (all
// is_mock) and exactly one General channel. Prints counts only — never the
// connection string or any row data.

import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL_UNPOOLED) {
  console.error('[verify-seed] DATABASE_URL_UNPOOLED is not set. Refusing.')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL_UNPOOLED)

const [{ contracts, non_mock: nonMock }] = await sql`
  SELECT count(*)::int AS contracts,
         count(*) FILTER (WHERE is_mock = false)::int AS non_mock
  FROM option_contracts
`
const [{ general_channels: generalChannels }] = await sql`
  SELECT count(*)::int AS general_channels FROM channels WHERE type = 'general'
`
const [{ members: memberRows }] = await sql`
  SELECT count(*)::int AS members
  FROM members
  WHERE email NOT LIKE '%@example.invalid'
`

console.log(`[verify-seed] option_contracts: ${contracts} (non-mock: ${nonMock})`)
console.log(`[verify-seed] general channels: ${generalChannels}`)
console.log(`[verify-seed] non-synthetic member rows: ${memberRows}`)

let ok = true
if (contracts !== 21) {
  console.error(`[verify-seed] FAIL: expected exactly 21 option contracts, found ${contracts} — seed is not idempotent or data was modified.`)
  ok = false
}
if (nonMock !== 0) {
  console.error('[verify-seed] FAIL: found option contracts with is_mock = false.')
  ok = false
}
if (generalChannels !== 1) {
  console.error(`[verify-seed] FAIL: expected exactly 1 General channel, found ${generalChannels}.`)
  ok = false
}
if (memberRows !== 0) {
  console.error('[verify-seed] FAIL: found member rows that are not synthetic test fixtures. The seed must never create members; invitations are a manual production-cutover step.')
  ok = false
}

if (!ok) process.exit(1)
console.log('[verify-seed] OK — seed is idempotent and mock-only.')
