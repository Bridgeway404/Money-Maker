import { describe, expect, it } from 'vitest'
 
// @ts-ignore — plain .mjs module without type declarations
import { evaluateGuard, OVERRIDE_VALUE } from '../lib/migrate-guard.mjs'

const base = {
  targetBranch: 'development',
  isProduction: undefined as string | undefined,
  override: undefined as string | undefined,
  hasDatabaseUrl: true,
}

describe('migration production guard', () => {
  it('refuses when DATABASE_URL_UNPOOLED is missing', () => {
    const d = evaluateGuard({ ...base, hasDatabaseUrl: false })
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('DATABASE_URL_UNPOOLED')
  })

  it('refuses when NEON_TARGET_BRANCH is missing or blank', () => {
    expect(evaluateGuard({ ...base, targetBranch: undefined }).allowed).toBe(false)
    expect(evaluateGuard({ ...base, targetBranch: '   ' }).allowed).toBe(false)
  })

  it('allows a non-production branch', () => {
    const d = evaluateGuard(base)
    expect(d.allowed).toBe(true)
    expect(d.production).toBe(false)
  })

  it.each(['main', 'master', 'production', 'prod', 'MAIN', 'Production'])(
    'refuses production-looking branch "%s" without the override',
    (branch) => {
      const d = evaluateGuard({ ...base, targetBranch: branch })
      expect(d.allowed).toBe(false)
      expect(d.production).toBe(true)
    }
  )

  it('refuses when NEON_TARGET_IS_PRODUCTION=true even on an unsuspicious branch name', () => {
    const d = evaluateGuard({ ...base, targetBranch: 'db-clone', isProduction: 'true' })
    expect(d.allowed).toBe(false)
    expect(d.production).toBe(true)
  })

  it('does not accept partial or wrong override values', () => {
    expect(
      evaluateGuard({ ...base, targetBranch: 'production', override: 'yes' }).allowed
    ).toBe(false)
    expect(
      evaluateGuard({ ...base, targetBranch: 'production', override: 'i_understand' }).allowed
    ).toBe(false)
  })

  it('allows production only with the exact override value', () => {
    const d = evaluateGuard({
      ...base,
      targetBranch: 'production',
      override: OVERRIDE_VALUE,
    })
    expect(d.allowed).toBe(true)
    expect(d.production).toBe(true)
  })

  it('never leaks anything resembling a connection string in reasons', () => {
    for (const d of [
      evaluateGuard(base),
      evaluateGuard({ ...base, hasDatabaseUrl: false }),
      evaluateGuard({ ...base, targetBranch: 'main' }),
    ]) {
      expect(d.reason).not.toMatch(/postgres(ql)?:\/\//i)
    }
  })
})
