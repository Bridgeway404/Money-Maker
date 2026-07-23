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
//
// SCOPE OF PROOF — what this suite does and does not validate:
//  * VALIDATED NOW (Postgres role/claim simulation): the suite assumes the
//    Postgres session role (`authenticated` / `anonymous`) and injects JWT
//    claims via set_config('request.jwt.claims', ...), which is exactly the
//    session state PostgREST establishes for a verified request. Every
//    policy decision below is made by Postgres itself.
//  * NOT VALIDATED HERE (blocked until Phase 1.5 / Next >= 16): issuing a
//    real Neon Auth token, its signature verification, and the Data API's
//    HTTP layer mapping token -> role + claims. That end-to-end path can
//    only be exercised once Neon Auth + the Data API are provisioned and
//    the app is upgraded; do not read a green run of this suite as proof
//    of the full token flow.

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
  let privateChannelA: string
  let privateChannelB: string
  let threadB: string
  let generalRecommendation: string
  let memberRecommendationB: string

  // Run a callback as a Data API role carrying the given JWT subject (or no
  // JWT at all). Everything happens inside a transaction that is always
  // rolled back, so read fixtures stay intact and write attempts leave no
  // residue.
  async function asRole<R>(
    role: 'authenticated' | 'anonymous',
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
      await client.query(`SET LOCAL ROLE ${role}`)
      return await fn(client)
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      client.release()
    }
  }

  const asAuthenticated = <R>(sub: string | null, fn: (c: PoolClient) => Promise<R>) =>
    asRole('authenticated', sub, fn)

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

    const chA = await pool.query(
      `INSERT INTO channels (type, name, owner_member_id)
       VALUES ('private', 'A private', $1) RETURNING id`,
      [memberA]
    )
    privateChannelA = chA.rows[0].id

    const ch = await pool.query(
      `INSERT INTO channels (type, name, owner_member_id)
       VALUES ('private', 'B private', $1) RETURNING id`,
      [memberB]
    )
    privateChannelB = ch.rows[0].id

    const genRec = await pool.query(
      `INSERT INTO recommendations (scope, owner_member_id, created_by_member_id, ticker, title, thesis, data_reliability)
       VALUES ('general', NULL, $1, 'MSFT', 'Community pick (test fixture)', 'synthetic', 'unverified') RETURNING id`,
      [memberA]
    )
    generalRecommendation = genRec.rows[0].id

    const memRec = await pool.query(
      `INSERT INTO recommendations (scope, owner_member_id, created_by_member_id, ticker, title, thesis, data_reliability)
       VALUES ('member', $1, $1, 'AAPL', 'B private idea (test fixture)', 'synthetic', 'user_entered') RETURNING id`,
      [memberB]
    )
    memberRecommendationB = memRec.rows[0].id

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

  it('a member cannot see another member\'s private channel either (B -> A)', { timeout: T }, async () => {
    const rows = await asAuthenticated(SUB_B, async (c) =>
      (await c.query(`SELECT id FROM channels WHERE id = $1`, [privateChannelA])).rows
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

  it('both active members can read general recommendations', { timeout: T }, async () => {
    for (const sub of [SUB_A, SUB_B]) {
      const rows = await asAuthenticated(sub, async (c) =>
        (await c.query(`SELECT id FROM recommendations WHERE id = $1`, [generalRecommendation])).rows
      )
      expect(rows).toHaveLength(1)
    }
  })

  it('member-scoped recommendations are visible to their owner only', { timeout: T }, async () => {
    const own = await asAuthenticated(SUB_B, async (c) =>
      (await c.query(`SELECT id FROM recommendations WHERE id = $1`, [memberRecommendationB])).rows
    )
    expect(own).toHaveLength(1)

    const other = await asAuthenticated(SUB_A, async (c) =>
      (await c.query(`SELECT id FROM recommendations WHERE id = $1`, [memberRecommendationB])).rows
    )
    expect(other).toHaveLength(0)
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

  it('ownership cannot be transferred through an update', { timeout: T }, async () => {
    // B updates their OWN row (passes USING) but tries to hand it to A —
    // the WITH CHECK on the new row must reject it.
    await expect(
      asAuthenticated(SUB_B, (c) =>
        c.query(
          `UPDATE watchlist_items SET member_id = $1 WHERE member_id = $2 AND ticker = 'AAPL'`,
          [memberA, memberB]
        )
      )
    ).rejects.toThrow(/row-level security/i)
  })

  it('the anonymous role has no access to protected tables', { timeout: T }, async () => {
    for (const table of ['members', 'channels', 'watchlist_items', 'option_contracts']) {
      await expect(
        asRole('anonymous', null, (c) => c.query(`SELECT count(*) FROM ${table}`))
      ).rejects.toThrow(/permission denied/i)
    }
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

  it('the privileged server role can perform authorized admin operations', { timeout: T }, async () => {
    // The pool connects as the migration/owner role; FORCE RLS applies to it
    // and access flows through the declared privileged_server_path policy.
    const ins = await pool.query(
      `INSERT INTO members (email, display_name, role, status)
       VALUES ('rls-test-priv@example.invalid', 'Priv Fixture', 'member', 'invited') RETURNING id`
    )
    const id = ins.rows[0].id
    const upd = await pool.query(`UPDATE members SET role = 'admin' WHERE id = $1`, [id])
    expect(upd.rowCount).toBe(1)
    const del = await pool.query(`DELETE FROM members WHERE id = $1`, [id])
    expect(del.rowCount).toBe(1)
  })

  it('member-facing Data API roles do not carry BYPASSRLS', { timeout: T }, async () => {
    const res = await pool.query(
      `SELECT rolname FROM pg_roles WHERE rolbypassrls AND rolname IN ('authenticated', 'anonymous')`
    )
    expect(res.rows).toHaveLength(0)
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
