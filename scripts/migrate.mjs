#!/usr/bin/env node
// Guarded migration runner: `npm run db:migrate`.
//
// Refuses to run against anything that looks like the production Neon branch
// unless the explicit override is present. Prints ONLY the branch name and
// whether it is considered production — never the connection string or any
// other environment value.

import { spawnSync } from 'node:child_process'
import { evaluateGuard } from './lib/migrate-guard.mjs'

const decision = evaluateGuard({
  targetBranch: process.env.NEON_TARGET_BRANCH,
  isProduction: process.env.NEON_TARGET_IS_PRODUCTION,
  override: process.env.ALLOW_PRODUCTION_MIGRATION,
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL_UNPOOLED),
})

console.log(`[db:migrate] target branch: ${process.env.NEON_TARGET_BRANCH ?? '(unset)'}`)
console.log(`[db:migrate] production target: ${decision.production ? 'YES' : 'no'}`)
console.log(`[db:migrate] ${decision.reason}`)

if (!decision.allowed) {
  console.error('[db:migrate] refused.')
  process.exit(1)
}

const result = spawnSync('npx', ['drizzle-kit', 'migrate'], {
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
