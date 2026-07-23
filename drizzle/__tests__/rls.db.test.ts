import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool, neonConfig } from '@neondatabase/serverless'
import type { PoolClient } from '@neondatabase/serverless'
import ws from 'ws'

// Database-backed RLS isolation tests.
//
// These run ONLY when NEON_TEST_DATABASE_URL is set. Point it at a
// DISPOSABLE Neon development branch that has had `npm run db:migrate`
// applied — NEVER at production. Without the variable the whole suite is
// skipped, so CI stays green with no database.
//
// All fixture identities are synthetic: *.example.invalid emails and fake
// JWT subjects. No real member data is ever created.

const url = process.env.NEON_TEST_DATABASE_URL

const SUB_A = 'rls-test-sub-admin'
const SUB_B = 'rls-test-sub-member'
const EMAIL_A = 'rls-test-admin@example.invalid'
const EMAIL_B = 'rls-test-member@example.invalid'

const T = 30_000

describe.skipIf(!url)('RLS isolation (live database)', () => {
  let pool: Pool
  let memberA: string // active admin
  let memberB: string // active regular member
  let privateChannelB: string
  let threadB: string

  // Run a callback as the Data API `authenticated` role carrying the given
  // JWT subject (or no JWT at all). Everything happens inside a transaction
  // that is always rolled back, so read fixtures stay intact and write
  // attempts leave no residue.
  async function asAuthenticated<R>(
    sub: string | null,
    fn: (c: PoolClient) => Promise<R>
  ): Promise<R> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      if (sub !== null) {
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub }),
        ])
      }
      await client.query('SET LOCAL ROLE authenticated')
      return await fn(client)
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      client.release()
    }
  }

  beforeAll(async () => {
    neonConfig.webSocketConstructor = ws
    pool = new Pool({ connectionString: url })

    // Privileged path (pool owner, covered by privileged_server_path).
    await pool.query(`DELETE FROM members WHERE email LIKE '%@example.invalid'`)

    const a = await pool.query(
      `INSERT INTO members (auth_user_id, email, display_name, role, status, accepted_at)
       VALUES ($1, $2, 'RLS Test Admin', 'admin', 'active', now()) RETURNING id`,
      [SUB_A, EMAIL_A]
    )
    memberA = a.rows[0].id

    const b = await pool.query(
      `INSERT INTO members (auth_user_id, email, display_name, role, status, accepted_at)
       VALUES ($1, $2, 'RLS Test Member', 'member', 'active', now()) RETURNING id`,
      [SUB_B, EMAIL_B]
    )
    memberB = b.rows[0].id

    await pool.query(
      `INSERT INTO channels (type, name) VALUES ('general', 'IOP General')
       ON CONFLICT DO NOTHING`
    )

    const ch = await pool.query(
      `INSERT INTO channels (type, name, owner_member_id)
       VALUES ('private', 'B private', $1) RETURNING id`,
      [memberB]
    )
    privateChannelB = ch.rows[0].id

    const th = await pool.query(
      `INSERT INTO conversation_threads (channel_id, created_by_member_id, title)
       VALUES ($1, $2, 'B thread') RETURNING id`,
      [privateChannelB, memberB]
    )
    threadB = th.rows[0].id

    await pool.query(
      `INSERT INTO channel_messages (thread_id, channel_id, author_member_id, role, content)
       VALUES ($1, $2, $3, 'user', 'private note')`,
      [threadB, privateChannelB, memberB]
    )

    await pool.query(
      `INSERT INTO watchlist_items (member_id, ticker, company_name, industry)
       VALUES ($1, 'AAPL', 'Apple Inc.', 'Technology')`,
      [memberB]
    )
  }, T)

  afterAll(async () => {
    if (pool) {
      // Cascades remove B's channel/thread/messages/watchlist rows.
      await pool
        .query(`DELETE FROM members WHERE email LIKE '%@example.invalid'`)
        .catch(() => undefined)
      await pool.end()
    }
  }, T)

  it('owner sees their private channel', { timeout: T }, async () => {
    const rows = await asAuthenticated(SUB_B, async (c) =>
      (await c.query(`SELECT id FROM channels WHERE type = 'private'`)).rows
    )
    expect(rows.map((r) => r.id)).toContain(privateChannelB)
  })

  it('an ADMIN cannot see another member\'s private channel (strict privacy)', { timeout: T }, async () => {
    const rows = await asAuthenticated(SUB_A, async (c) =>
      (await c.query(`SELECT id FROM channels WHERE id = $1`, [privateChannelB])).rows
    )
    expect(rows).toHaveLength(0)
  })

  it('an ADMIN cannot read private threads or messages', { timeout: T }, async () => {
    const { threads, messages } = await asAuthenticated(SUB_A, async (c) => ({
      threads: (await c.query(`SELECT id FROM conversation_threads WHERE channel_id = $1`, [privateChannelB])).rows,
      messages: (await c.query(`SELECT id FROM channel_messages WHERE channel_id = $1`, [privateChannelB])).rows,
    }))
    expect(threads).toHaveLength(0)
    expect(messages).toHaveLength(0)
  })

  it('both active members see the General channel', { timeout: T }, async () => {
    for (const sub of [SUB_A, SUB_B]) {
      const rows = await asAuthenticated(sub, async (c) =>
        (await c.query(`SELECT id FROM channels WHERE type = 'general'`)).rows
      )
      expect(rows.length).toBe(1)
    }
  })

  it('watchlist rows are owner-only', { timeout: T }, async () => {
    const own = await asAuthenticated(SUB_B, async (c) =>
      (await c.query(`SELECT ticker FROM watchlist_items`)).rows
    )
    expect(own.map((r) => r.ticker)).toContain('AAPL')

    const other = await asAuthenticated(SUB_A, async (c) =>
      (await c.query(`SELECT id FROM watchlist_items WHERE member_id = $1`, [memberB])).rows
    )
    expect(other).toHaveLength(0)
  })

  it('without a JWT, authenticated sees zero rows everywhere', { timeout: T }, async () => {
    const counts = await asAuthenticated(null, async (c) => ({
      members: (await c.query(`SELECT count(*)::int AS n FROM members`)).rows[0].n,
      channels: (await c.query(`SELECT count(*)::int AS n FROM channels`)).rows[0].n,
      watchlist: (await c.query(`SELECT count(*)::int AS n FROM watchlist_items`)).rows[0].n,
    }))
    expect(counts).toEqual({ members: 0, channels: 0, watchlist: 0 })
  })

  it('WITH CHECK blocks inserting rows for another member', { timeout: T }, async () => {
    await expect(
      asAuthenticated(SUB_A, (c) =>
        c.query(
          `INSERT INTO watchlist_items (member_id, ticker, company_name, industry)
           VALUES ($1, 'MSFT', 'Microsoft', 'Technology')`,
          [memberB]
        )
      )
    ).rejects.toThrow(/row-level security/i)
  })

  it('a member can insert their own rows', { timeout: T }, async () => {
    const inserted = await asAuthenticated(SUB_B, async (c) => {
      const r = await c.query(
        `INSERT INTO watchlist_items (member_id, ticker, company_name, industry)
         VALUES ($1, 'MSFT', 'Microsoft', 'Technology') RETURNING id`,
        [memberB]
      )
      return r.rows.length
    })
    expect(inserted).toBe(1) // rolled back afterwards
  })

  it('members cannot update another member\'s profile row', { timeout: T }, async () => {
    const updated = await asAuthenticated(SUB_A, async (c) =>
      (
        await c.query(`UPDATE members SET display_name = 'hijack' WHERE id = $1`, [memberB])
      ).rowCount
    )
    expect(updated).toBe(0)
  })

  it('inserting a non-user message via the member path is rejected', { timeout: T }, async () => {
    await expect(
      asAuthenticated(SUB_B, (c) =>
        c.query(
          `INSERT INTO channel_messages (thread_id, channel_id, author_member_id, role, content)
           VALUES ($1, $2, $3, 'assistant', 'spoofed AI message')`,
          [threadB, privateChannelB, memberB]
        )
      )
    ).rejects.toThrow(/row-level security/i)
  })

  it('a disabled member loses all access', { timeout: T }, async () => {
    await pool.query(`UPDATE members SET status = 'disabled', disabled_at = now() WHERE id = $1`, [memberB])
    try {
      const counts = await asAuthenticated(SUB_B, async (c) => ({
        channels: (await c.query(`SELECT count(*)::int AS n FROM channels`)).rows[0].n,
        watchlist: (await c.query(`SELECT count(*)::int AS n FROM watchlist_items`)).rows[0].n,
      }))
      expect(counts).toEqual({ channels: 0, watchlist: 0 })
    } finally {
      await pool.query(
        `UPDATE members SET status = 'active', disabled_at = NULL WHERE id = $1`,
        [memberB]
      )
    }
  })
})
