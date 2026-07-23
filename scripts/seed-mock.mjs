#!/usr/bin/env node
// Mock-data-only seed: `npm run db:seed`.
//
// Seeds exactly two things, both safe and clearly labeled:
//  * the 21 mock option contracts (every row is_mock=true — the table's
//    CHECK constraint refuses anything else),
//  * the single "IOP General" channel (no members attached).
//
// It never creates users, members, invitations, or email addresses.
// Same production guard as db:migrate; prints only the branch name and the
// production flag — never the connection string.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'
import { evaluateGuard } from './lib/migrate-guard.mjs'

const decision = evaluateGuard({
  targetBranch: process.env.NEON_TARGET_BRANCH,
  isProduction: process.env.NEON_TARGET_IS_PRODUCTION,
  override: process.env.ALLOW_PRODUCTION_MIGRATION,
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL_UNPOOLED),
})

console.log(`[db:seed] target branch: ${process.env.NEON_TARGET_BRANCH ?? '(unset)'}`)
console.log(`[db:seed] production target: ${decision.production ? 'YES' : 'no'}`)
console.log(`[db:seed] ${decision.reason}`)

if (!decision.allowed) {
  console.error('[db:seed] refused.')
  process.exit(1)
}

const contractsPath = fileURLToPath(
  new URL('../drizzle/seed/mock-option-contracts.json', import.meta.url)
)
const contracts = JSON.parse(readFileSync(contractsPath, 'utf8'))

const sql = neon(process.env.DATABASE_URL_UNPOOLED)

const [{ count: existing }] = await sql`
  SELECT count(*)::int AS count FROM option_contracts
`

if (existing > 0) {
  console.log(
    `[db:seed] option_contracts already has ${existing} rows — skipping contract seed (idempotent).`
  )
} else {
  for (const c of contracts) {
    await sql`
      INSERT INTO option_contracts (
        ticker, option_type, expiration_date, strike_price, current_premium,
        all_time_high_premium, depreciation_pct, implied_volatility, delta,
        theta, volume, open_interest, is_mock
      ) VALUES (
        ${c.ticker}, ${c.option_type}, ${c.expiration_date}, ${c.strike_price},
        ${c.current_premium}, ${c.all_time_high_premium}, ${c.depreciation_pct},
        ${c.implied_volatility}, ${c.delta}, ${c.theta}, ${c.volume},
        ${c.open_interest}, ${c.is_mock}
      )
    `
  }
  console.log(`[db:seed] inserted ${contracts.length} mock option contracts.`)
}

// The partial unique index (one 'general' channel) makes this idempotent.
const inserted = await sql`
  INSERT INTO channels (type, name)
  VALUES ('general', 'IOP General')
  ON CONFLICT DO NOTHING
  RETURNING id
`
console.log(
  inserted.length > 0
    ? '[db:seed] created the IOP General channel.'
    : '[db:seed] IOP General channel already exists — skipped.'
)

console.log('[db:seed] done. No users, members, or invitations were created.')
