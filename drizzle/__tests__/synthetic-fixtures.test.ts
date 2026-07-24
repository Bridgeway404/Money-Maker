import { describe, expect, it } from 'vitest'
import {
  CLEANUP_STATEMENTS,
  FIXTURE_EMAILS,
  cleanupSyntheticFixtures,
  guardCleanupTarget,
} from './helpers/synthetic-fixtures'

// Unit coverage for the fixture-cleanup helper — runs with NO database, so
// the safety properties are enforced on every ordinary CI run.

function mockClient() {
  const calls: { sql: string; params?: unknown[] }[] = []
  return {
    calls,
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params })
      return { rows: [] }
    },
  }
}

const DEV_ENV = { NEON_TARGET_BRANCH: 'development', NEON_TARGET_IS_PRODUCTION: 'false' }

describe('synthetic fixture cleanup', () => {
  it('deletes dependents before members: messages -> threads -> channels -> members last', () => {
    const idx = (needle: string) =>
      CLEANUP_STATEMENTS.findIndex((s) => s.includes(needle))
    const firstMessages = idx('DELETE FROM channel_messages')
    const firstThreads = idx('DELETE FROM conversation_threads')
    const channelsDelete = idx('DELETE FROM channels')
    const membersDelete = CLEANUP_STATEMENTS.findIndex((s) =>
      s.trimStart().startsWith('DELETE FROM members')
    )
    expect(firstMessages).toBeGreaterThanOrEqual(0)
    expect(firstMessages).toBeLessThan(firstThreads)
    expect(firstThreads).toBeLessThan(channelsDelete)
    expect(membersDelete).toBe(CLEANUP_STATEMENTS.length - 1)
  })

  it('every statement is scoped by the exact fixture email list — never LIKE, never a domain wildcard', async () => {
    const client = mockClient()
    await cleanupSyntheticFixtures(client, DEV_ENV)
    expect(client.calls).toHaveLength(CLEANUP_STATEMENTS.length)
    for (const call of client.calls) {
      expect(call.sql).not.toMatch(/like/i)
      expect(call.sql).not.toContain('%')
      expect(call.sql).toContain('= ANY($1)')
      expect(call.params).toEqual([[...FIXTURE_EMAILS]])
    }
  })

  it('cannot match unrelated @example.invalid rows: fixture emails are exact, known values', () => {
    for (const email of FIXTURE_EMAILS) {
      expect(email).toMatch(/^rls-test-[a-z]+@example\.invalid$/)
    }
    // The member delete carries no pattern operator — only the exact array.
    const membersDelete = CLEANUP_STATEMENTS[CLEANUP_STATEMENTS.length - 1]
    expect(membersDelete.replace(/\s+/g, ' ').trim()).toBe(
      'DELETE FROM members WHERE email = ANY($1)'
    )
  })

  it('never touches the seeded General channel or option_contracts', () => {
    for (const s of CLEANUP_STATEMENTS) {
      expect(s).not.toContain('option_contracts')
    }
    const channelsDelete = CLEANUP_STATEMENTS.find((s) => s.includes('DELETE FROM channels'))
    expect(channelsDelete).toContain(`type = 'private'`)
  })

  it('is a no-op-safe sequence when no fixtures exist (all deletes simply match zero rows)', async () => {
    const client = mockClient()
    await expect(cleanupSyntheticFixtures(client, DEV_ENV)).resolves.toBeUndefined()
    // Running it again (partial/failed prior run simulation) issues the same
    // idempotent statements.
    await expect(cleanupSyntheticFixtures(client, DEV_ENV)).resolves.toBeUndefined()
    expect(client.calls).toHaveLength(CLEANUP_STATEMENTS.length * 2)
  })

  it.each(['production', 'main', 'master', 'prod', 'PRODUCTION'])(
    'refuses to execute anything when NEON_TARGET_BRANCH is "%s"',
    async (branch) => {
      const client = mockClient()
      await expect(
        cleanupSyntheticFixtures(client, { NEON_TARGET_BRANCH: branch })
      ).rejects.toThrow(/refused.*production/i)
      expect(client.calls).toHaveLength(0)
    }
  )

  it('refuses when NEON_TARGET_IS_PRODUCTION=true regardless of branch name', async () => {
    const client = mockClient()
    await expect(
      cleanupSyntheticFixtures(client, {
        NEON_TARGET_BRANCH: 'db-copy',
        NEON_TARGET_IS_PRODUCTION: 'true',
      })
    ).rejects.toThrow(/refused.*production/i)
    expect(client.calls).toHaveLength(0)
  })

  it('allows development and unset targets', () => {
    expect(() => guardCleanupTarget(DEV_ENV)).not.toThrow()
    expect(() => guardCleanupTarget({})).not.toThrow()
  })
})
