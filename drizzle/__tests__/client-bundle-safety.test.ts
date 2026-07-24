import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Nothing under src/ may reference the Neon connection strings or auth
// secret: the app has not been cut over, and even after cutover those values
// are tooling/server-only (browser code talks to the Data API with a JWT).

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const repoRoot = join(__dirname, '..', '..')
// Test files are never bundled; the scan covers runtime source only.
const srcFiles = walk(join(repoRoot, 'src')).filter(
  (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.includes('__tests__')
)

const FORBIDDEN_IN_SRC = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'NEON_AUTH_COOKIE_SECRET',
  '@neondatabase/serverless',
  '@neondatabase/auth',
  'drizzle-orm',
  'drizzle/migrations',
  'SUPABASE_SERVICE_ROLE',
]

describe('client/bundle safety', () => {
  it('scans a non-trivial number of source files', () => {
    expect(srcFiles.length).toBeGreaterThan(20)
  })

  it.each(FORBIDDEN_IN_SRC)('src/ never references %s', (needle) => {
    const offenders = srcFiles.filter((f) => readFileSync(f, 'utf8').includes(needle))
    expect(offenders, `found in: ${offenders.join(', ')}`).toEqual([])
  })

  it('package.json does not depend on the Next>=16-only Neon packages', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(allDeps['@neondatabase/auth']).toBeUndefined()
    expect(allDeps['@neondatabase/neon-js']).toBeUndefined()
  })

  it('the app still declares its Supabase runtime dependencies (no premature cutover)', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    expect(pkg.dependencies['@supabase/supabase-js']).toBeDefined()
    expect(pkg.dependencies['@supabase/ssr']).toBeDefined()
  })
})
