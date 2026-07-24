import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool, neonConfig } from '@neondatabase/serverless'
import type { PoolClient } from '@neondatabase/serverless'
import ws from 'ws'
import {
  cleanupSyntheticFixtures,
  guardCleanupTarget,
} from './helpers/synthetic-fixtures'

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
// ROLE SIMULATION (test-only): `SET ROLE x` requires the session role to be
// a member of x (with the SET option since PostgreSQL 16). The migration
// CREATEs `authenticated`/`anonymous`, and PostgreSQL leaves the creating
// role with ADMIN OPTION on roles it creates — but not necessarily with a
// SET-capable membership, which is exactly what run 30032400037 hit
// ("permission denied to set role"). The setup below probes SET ROLE and,
// only when (a) it fails and (b) the environment attests
// NEON_TARGET_BRANCH=development + NEON_TARGET_IS_PRODUCTION=false, grants
// the session role a test-scoped membership, tracked and revoked in
// afterAll. This changes nothing in the production authorization model:
// the grant lives only on the disposable development branch for the
// duration of the suite, and the suite refuses to touch role membership
// anywhere else. No role ever receives BYPASSRLS.
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
const SUB_C = 'rls-test-sub-lifecycle'
const EMAIL_A = 'rls-test-admin@example.invalid'
const EMAIL_B = 'rls-test-member@example.invalid'
const EMAIL_C = 'rls-test-lifecycle@example.invalid'

const TEST_ROLES = ['authenticated', 'anonymous'] as const
type TestRole = (typeof TEST_ROLES)[number]

const T = 30_000

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`

describe.skipIf(!url)('RLS isolation (live database)', () => {
  let pool: Pool
  let sessionRole: string // the Neon connection role (never printed with secrets — it is only a role name)
  const grantedByTest: TestRole[] = []
  const preExistingMemberships: TestRole[] = []
  let memberA: string // active admin
  let memberB: string // active regular member
  let privateChannelA: string
  let privateChannelB: string
  let threadB: string
  let generalRecommendation: string
  let memberRecommendationB: string

  // Probe whether the current session role can SET ROLE to `role`.
  async function canSetRole(role: TestRole): Promise<boolean> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET LOCAL ROLE ${role}`)
      return true
    } catch {
      return false
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      client.release()
    }
  }

  // Run a callback as a Data API role carrying the given JWT subject (or no
  // JWT at all). Everything happens inside a transaction that is always
  // rolled back, so read fixtures stay intact and write attempts leave no
  // residue. The helper VERIFIES the role switch took effect — a failure to
  // assume the role is a test-setup error, never an RLS result.
  async function asRole<R>(
    role: TestRole,
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
      try {
        await client.query(`SET LOCAL ROLE ${role}`)
      } catch (cause) {
        throw new Error(
          `RLS test setup failed: database session could not assume role ${role} (${(cause as Error).message})`
        )
      }
      const { rows } = await client.query('SELECT current_user AS cu')
      if (rows[0].cu !== role) {
        throw new Error(
          `RLS test setup failed: database session could not assume role ${role} (current_user is ${rows[0].cu})`
        )
      }
      return await fn(client)
    } finally {
      await client.query('ROLLBACK').catch(() => undefined)
      client.release()
    }
  }

  const asAuthenticated = <R>(sub: string | null, fn: (c: PoolClient) => Promise<R>) =>
    asRole('authenticated', sub, fn)

  // Assert that a member-path write was rejected BY ROW-LEVEL SECURITY —
  // right SQLSTATE (42501) and specifically the new-row policy violation
  // message, so a role/grant failure can never masquerade as an RLS pass.
  async function expectRlsWriteViolation(p: Promise<unknown>) {
    let err: (Error & { code?: string }) | undefined
    try {
      await p
    } catch (e) {
      err = e as Error & { code?: string }
    }
    expect(err, 'expected the write to be rejected').toBeTruthy()
    expect(err!.message).toMatch(/new row violates row-level security policy/i)
    expect(err!.code).toBe('42501')
  }

  beforeAll(async () => {
    // Refuse the whole suite, before any connection, if the attested target
    // looks like production.
    guardCleanupTarget(process.env)

    neonConfig.webSocketConstructor = ws
    pool = new Pool({ connectionString: url })

    // --- role-simulation bootstrap (test-only, development branch only) ---
    const su = await pool.query('SELECT session_user AS su')
    sessionRole = su.rows[0].su as string

    for (const role of TEST_ROLES) {
      if (await canSetRole(role)) {
        // SET-capable before we did anything: either platform-provided or
        // residue of an earlier suite run whose revoke did not land. Never
        // revoked by this run (we only revoke what we grant).
        preExistingMemberships.push(role)
        continue
      }
      const branch = process.env.NEON_TARGET_BRANCH
      const prodFlag = String(process.env.NEON_TARGET_IS_PRODUCTION ?? '').toLowerCase()
      if (branch !== 'development' || prodFlag !== 'false') {
        throw new Error(
          `RLS test setup failed: database session could not assume role ${role}. ` +
            `The suite only adjusts role membership when NEON_TARGET_BRANCH=development ` +
            `and NEON_TARGET_IS_PRODUCTION=false are both set (never against production). ` +
            `Set them for a disposable development branch, or grant the membership manually.`
        )
      }
      // The session role created `authenticated`/`anonymous` in the RLS
      // migration and therefore holds ADMIN OPTION on them, which authorizes
      // granting (and later revoking) membership — including to itself.
      // If that assumption is ever wrong on a given Postgres/Neon version,
      // the GRANT or the re-probe below fails loudly as a setup error.
      await pool.query(`GRANT ${role} TO ${quoteIdent(sessionRole)}`)
      grantedByTest.push(role)
      if (!(await canSetRole(role))) {
        throw new Error(
          `RLS test setup failed: database session could not assume role ${role} even after a test-scoped membership grant.`
        )
      }
    }

    // --- fixtures (privileged path; synthetic identities only) ---
    // Dependency-safe, exact-email cleanup of anything a previous (possibly
    // failed) run left behind. Never a broad LIKE-delete on members.
    await cleanupSyntheticFixtures(pool)

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
    if (!pool) return
    // Three independent teardown stages: a failure in one must not skip the
    // others, and problems are REPORTED (thrown at the end) instead of being
    // silently swallowed — silent suppression is what left run 1's fixtures
    // behind for run 2 to trip over. Postgres error messages contain no
    // connection values.
    const problems: string[] = []

    try {
      await cleanupSyntheticFixtures(pool)
    } catch (e) {
      problems.push(`fixture cleanup failed: ${(e as Error).message}`)
    }

    // Revoke ONLY memberships this suite added (tracked above) — never
    // pre-existing ones, which are not ours to judge.
    for (const role of grantedByTest) {
      try {
        await pool.query(`REVOKE ${role} FROM ${quoteIdent(sessionRole)}`)
      } catch (e) {
        problems.push(`revoking test-granted membership ${role} failed: ${(e as Error).message}`)
      }
    }

    try {
      await pool.end()
    } catch (e) {
      problems.push(`pool shutdown failed: ${(e as Error).message}`)
    }

    if (problems.length > 0) {
      throw new Error(`RLS suite teardown problems: ${problems.join(' | ')}`)
    }
  }, T)

  // ------------------------------------------------------------------
  // Setup diagnostics — prove the simulation machinery itself
  // ------------------------------------------------------------------

  it('diagnostic: session assumes authenticated; session_user stays the connection role', { timeout: T }, async () => {
    const ids = await asRole('authenticated', null, async (c) =>
      (await c.query('SELECT current_user AS cu, session_user AS su')).rows[0]
    )
    expect(ids.cu).toBe('authenticated')
    expect(ids.su).toBe(sessionRole)
    expect(ids.su).not.toBe('authenticated')
  })

  it('diagnostic: session assumes anonymous; session_user stays the connection role', { timeout: T }, async () => {
    const ids = await asRole('anonymous', null, async (c) =>
      (await c.query('SELECT current_user AS cu, session_user AS su')).rows[0]
    )
    expect(ids.cu).toBe('anonymous')
    expect(ids.su).toBe(sessionRole)
  })

  it('diagnostic: connection-role properties recorded; no member-facing BYPASSRLS', { timeout: T }, async () => {
    const props = await pool.query(
      `SELECT rolname, rolsuper, rolbypassrls, rolcreaterole,
              pg_has_role(session_user, 'authenticated', 'MEMBER') AS member_of_authenticated,
              pg_has_role(session_user, 'anonymous', 'MEMBER') AS member_of_anonymous
       FROM pg_roles WHERE rolname = session_user`
    )
    const p = props.rows[0]
    // Role names only — never connection values. Memberships are classified
    // so a reviewer can tell residue of an earlier failed run (pre-existing,
    // not revoked by us) apart from what this run added and will revoke.
    console.log(
      `[rls.db] connection role: ${p.rolname} | superuser: ${p.rolsuper} | bypassrls: ${p.rolbypassrls} | createrole: ${p.rolcreaterole} | member of authenticated: ${p.member_of_authenticated} | member of anonymous: ${p.member_of_anonymous}`
    )
    console.log(
      `[rls.db] memberships pre-existing before this run (left alone; on a dev branch these are likely residue of an earlier failed run and safe to revoke manually): ${preExistingMemberships.join(', ') || '(none)'} | granted by this run (revoked in teardown): ${grantedByTest.join(', ') || '(none)'}`
    )
    expect(p.rolbypassrls).toBe(false)

    const bypass = await pool.query(
      `SELECT rolname FROM pg_roles WHERE rolbypassrls AND rolname IN ('authenticated', 'anonymous')`
    )
    expect(bypass.rows).toHaveLength(0)
  })

  // ------------------------------------------------------------------
  // Read isolation
  // ------------------------------------------------------------------

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

  // ------------------------------------------------------------------
  // Write protection (RLS specifically — not role/grant noise)
  // ------------------------------------------------------------------

  it('WITH CHECK blocks inserting rows for another member', { timeout: T }, async () => {
    await expectRlsWriteViolation(
      asAuthenticated(SUB_A, (c) =>
        c.query(
          `INSERT INTO watchlist_items (member_id, ticker, company_name, industry)
           VALUES ($1, 'MSFT', 'Microsoft', 'Technology')`,
          [memberB]
        )
      )
    )
    // Prove the row was never written (privileged read).
    const check = await pool.query(
      `SELECT count(*)::int AS n FROM watchlist_items WHERE member_id = $1 AND ticker = 'MSFT'`,
      [memberB]
    )
    expect(check.rows[0].n).toBe(0)
  })

  it('ownership cannot be transferred through an update', { timeout: T }, async () => {
    await expectRlsWriteViolation(
      asAuthenticated(SUB_B, (c) =>
        c.query(
          `UPDATE watchlist_items SET member_id = $1 WHERE member_id = $2 AND ticker = 'AAPL'`,
          [memberA, memberB]
        )
      )
    )
    // Prove ownership is unchanged.
    const check = await pool.query(
      `SELECT member_id FROM watchlist_items WHERE ticker = 'AAPL' AND member_id IN ($1, $2)`,
      [memberA, memberB]
    )
    expect(check.rows).toHaveLength(1)
    expect(check.rows[0].member_id).toBe(memberB)
  })

  it('inserting a non-user message via the member path is rejected', { timeout: T }, async () => {
    await expectRlsWriteViolation(
      asAuthenticated(SUB_B, (c) =>
        c.query(
          `INSERT INTO channel_messages (thread_id, channel_id, author_member_id, role, content)
           VALUES ($1, $2, $3, 'assistant', 'spoofed AI message')`,
          [threadB, privateChannelB, memberB]
        )
      )
    )
    const check = await pool.query(
      `SELECT count(*)::int AS n FROM channel_messages WHERE thread_id = $1 AND role <> 'user'`,
      [threadB]
    )
    expect(check.rows[0].n).toBe(0)
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
    const check = await pool.query(`SELECT display_name FROM members WHERE id = $1`, [memberB])
    expect(check.rows[0].display_name).toBe('RLS Test Member')
  })

  // ------------------------------------------------------------------
  // Anonymous and lifecycle
  // ------------------------------------------------------------------

  it('the anonymous role is denied on each protected table (table-level, not set-role noise)', { timeout: T }, async () => {
    for (const table of ['members', 'channels', 'watchlist_items', 'option_contracts']) {
      // asRole verifies current_user = 'anonymous' BEFORE the query runs, so
      // the only error that can surface here is from the table access itself.
      let err: (Error & { code?: string }) | undefined
      try {
        await asRole('anonymous', null, (c) => c.query(`SELECT count(*) FROM ${table}`))
      } catch (e) {
        err = e as Error & { code?: string }
      }
      expect(err, `expected SELECT on ${table} to be denied for anonymous`).toBeTruthy()
      expect(err!.message).toMatch(new RegExp(`permission denied for table ${table}`, 'i'))
      expect(err!.message).not.toMatch(/set role/i)
      expect(err!.code).toBe('42501')
    }
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

  it('member-deletion policy: disable preserves authorship; hard delete with surviving user messages is rejected', { timeout: T }, async () => {
    // Member C authors a user message in a General-channel thread created by
    // A — content that survives C, so C must not be hard-deletable.
    const general = await pool.query(`SELECT id FROM channels WHERE type = 'general'`)
    const generalId = general.rows[0].id

    const c = await pool.query(
      `INSERT INTO members (auth_user_id, email, display_name, role, status, accepted_at)
       VALUES ($1, $2, 'RLS Lifecycle Fixture', 'member', 'active', now()) RETURNING id`,
      [SUB_C, EMAIL_C]
    )
    const memberC = c.rows[0].id

    const th = await pool.query(
      `INSERT INTO conversation_threads (channel_id, created_by_member_id, title)
       VALUES ($1, $2, 'Lifecycle thread') RETURNING id`,
      [generalId, memberA]
    )
    const msg = await pool.query(
      `INSERT INTO channel_messages (thread_id, channel_id, author_member_id, role, content)
       VALUES ($1, $2, $3, 'user', 'lifecycle fixture message') RETURNING id`,
      [th.rows[0].id, generalId, memberC]
    )
    const messageId = msg.rows[0].id

    // 1. Disabling succeeds and authorship is preserved.
    const disabled = await pool.query(
      `UPDATE members SET status = 'disabled', disabled_at = now() WHERE id = $1`,
      [memberC]
    )
    expect(disabled.rowCount).toBe(1)
    const afterDisable = await pool.query(
      `SELECT author_member_id FROM channel_messages WHERE id = $1`,
      [messageId]
    )
    expect(afterDisable.rows[0].author_member_id).toBe(memberC)

    // 2. Hard deletion is rejected by the author FK (23503), not silently
    //    absorbed via SET NULL or cascade.
    let err: (Error & { code?: string }) | undefined
    try {
      await pool.query(`DELETE FROM members WHERE id = $1`, [memberC])
    } catch (e) {
      err = e as Error & { code?: string }
    }
    expect(err, 'expected hard delete of a member with surviving user messages to fail').toBeTruthy()
    expect(err!.code).toBe('23503')

    // 3. Nothing was orphaned: the message still exists with its author.
    const afterDelete = await pool.query(
      `SELECT author_member_id FROM channel_messages WHERE id = $1`,
      [messageId]
    )
    expect(afterDelete.rows).toHaveLength(1)
    expect(afterDelete.rows[0].author_member_id).toBe(memberC)
    // Fixture removal (message -> thread -> member C) happens via
    // cleanupSyntheticFixtures in afterAll, in dependency-safe order.
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
