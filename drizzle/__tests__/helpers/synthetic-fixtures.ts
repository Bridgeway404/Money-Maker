// Synthetic-fixture cleanup for the live RLS suite.
//
// Design constraints (validation run 30060811437 post-mortem):
//  * NEVER a broad `DELETE FROM members WHERE email LIKE '%@example.invalid'`
//    — cleanup is scoped to the EXACT fixture emails below, so unrelated
//    rows that merely share the domain are untouched.
//  * Dependency-safe order: with the NO ACTION author/creator FKs (migration
//    0002), member rows can only be deleted after every synthetic message
//    and thread is gone — dependents first, members last.
//  * Idempotent and partial-safe: every statement is a scoped DELETE that
//    matches zero rows when there is nothing to clean.
//  * Never touches the seeded IOP General channel or option_contracts.
//  * Refuses to run against anything that looks like production.

export const FIXTURE_EMAILS = [
  'rls-test-admin@example.invalid',
  'rls-test-member@example.invalid',
  'rls-test-lifecycle@example.invalid',
  'rls-test-priv@example.invalid',
] as const

const PRODUCTION_BRANCH_PATTERN = /^(main|master|production|prod)$/i

export interface CleanupEnv {
  NEON_TARGET_BRANCH?: string
  NEON_TARGET_IS_PRODUCTION?: string
  // Allows passing process.env directly.
  [key: string]: string | undefined
}

export interface QueryClient {
  query(sql: string, params?: unknown[]): Promise<unknown>
}

// Throws when the attested target looks like production. An unset branch is
// allowed (plain local runs against NEON_TEST_DATABASE_URL), but an explicit
// production name or flag is always refused.
export function guardCleanupTarget(env: CleanupEnv): void {
  const branch = (env.NEON_TARGET_BRANCH ?? '').trim()
  const prodFlag = String(env.NEON_TARGET_IS_PRODUCTION ?? '').toLowerCase() === 'true'
  if (PRODUCTION_BRANCH_PATTERN.test(branch) || prodFlag) {
    throw new Error(
      'synthetic fixture cleanup refused: the attested target looks like production ' +
        `(NEON_TARGET_BRANCH="${branch || '(unset)'}", NEON_TARGET_IS_PRODUCTION=${prodFlag}). ` +
        'Fixture cleanup only ever runs against a disposable development branch.'
    )
  }
}

// Ordered, exact-match statements. $1 is always the fixture email array.
// Exported for the unit tests that verify ordering and scoping.
export const CLEANUP_STATEMENTS: readonly string[] = [
  // 1. Messages authored by fixture members.
  `DELETE FROM channel_messages
   WHERE author_member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  // 2. Messages in threads created by fixture members (covers non-fixture
  //    authors replying in a fixture thread).
  `DELETE FROM channel_messages
   WHERE thread_id IN (
     SELECT t.id FROM conversation_threads t
     JOIN members m ON m.id = t.created_by_member_id
     WHERE m.email = ANY($1)
   )`,
  // 3. Messages in fixture members' private channels.
  `DELETE FROM channel_messages
   WHERE channel_id IN (
     SELECT c.id FROM channels c
     JOIN members m ON m.id = c.owner_member_id
     WHERE c.type = 'private' AND m.email = ANY($1)
   )`,
  // 4. Threads created by fixture members.
  `DELETE FROM conversation_threads
   WHERE created_by_member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  // 5. Threads in fixture members' private channels.
  `DELETE FROM conversation_threads
   WHERE channel_id IN (
     SELECT c.id FROM channels c
     JOIN members m ON m.id = c.owner_member_id
     WHERE c.type = 'private' AND m.email = ANY($1)
   )`,
  // 6. Channel memberships.
  `DELETE FROM channel_memberships
   WHERE member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  // 7. Private channels owned by fixture members (never the General channel).
  `DELETE FROM channels
   WHERE type = 'private'
     AND owner_member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  // 8. Recommendations created by or scoped to fixture members.
  `DELETE FROM recommendations
   WHERE created_by_member_id IN (SELECT id FROM members WHERE email = ANY($1))
      OR owner_member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  // 9-15. Member-owned app rows.
  `DELETE FROM watchlist_items
   WHERE member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  `DELETE FROM portfolio_holdings
   WHERE member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  `DELETE FROM stock_analyses
   WHERE member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  `DELETE FROM research_reports
   WHERE member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  `DELETE FROM leaps_recommendations
   WHERE member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  `DELETE FROM chat_messages
   WHERE member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  `DELETE FROM onboarding_answers
   WHERE member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  `DELETE FROM scoring_config
   WHERE member_id IN (SELECT id FROM members WHERE email = ANY($1))`,
  // 16. Member rows last, by exact email.
  `DELETE FROM members WHERE email = ANY($1)`,
]

export async function cleanupSyntheticFixtures(
  client: QueryClient,
  env: CleanupEnv = process.env as CleanupEnv
): Promise<void> {
  guardCleanupTarget(env)
  for (const statement of CLEANUP_STATEMENTS) {
    await client.query(statement, [[...FIXTURE_EMAILS]])
  }
}
