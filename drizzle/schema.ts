import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// IOP Investing Tool schema for Neon Postgres.
//
// Two groups of tables:
//  1. IOP community foundation (members, channels, threads, messages,
//     recommendations) — new in this migration.
//  2. App tables carried over from supabase/schema.sql with `user_id`
//     (auth.users FK) replaced by `member_id` (members FK). Column names and
//     types otherwise match the Supabase originals so a future Option B data
//     migration is a column-for-column copy.
//
// RLS is defined in the companion custom migration
// (drizzle/migrations/*_rls_policies.sql), not here — drizzle-kit does not
// model policies. Every table below is ENABLE + FORCE RLS with default-deny.

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const memberRole = pgEnum('member_role', ['admin', 'member'])

export const memberStatus = pgEnum('member_status', [
  'invited',
  'active',
  'disabled',
  'revoked',
])

export const channelType = pgEnum('channel_type', ['general', 'private'])

export const channelStatus = pgEnum('channel_status', ['active', 'archived'])

export const channelMemberRole = pgEnum('channel_member_role', [
  'owner',
  'participant',
])

export const messageRole = pgEnum('message_role', [
  'user',
  'assistant',
  'system',
])

export const recommendationScope = pgEnum('recommendation_scope', [
  'general',
  'member',
])

export const recommendationStatus = pgEnum('recommendation_status', [
  'active',
  'closed',
  'archived',
])

// Deliberately has NO "live" value: until a real market-data provider exists,
// nothing in the database may claim to be live data.
export const dataReliability = pgEnum('data_reliability', [
  'mock',
  'sample',
  'user_entered',
  'unverified',
])

// ---------------------------------------------------------------------------
// IOP community foundation
// ---------------------------------------------------------------------------

// Profile record AND invitation allowlist in one table (doc 03, Decision 3).
// An admin creates a row with status='invited' and no auth_user_id; signup is
// only honored for an email that matches an invited row, and links the Neon
// Auth user id to it.
export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authUserId: text('auth_user_id').unique(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    role: memberRole('role').notNull().default('member'),
    status: memberStatus('status').notNull().default('invited'),
    invitedAt: timestamp('invited_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('members_email_lower_unique').on(sql`lower(${t.email})`),
    check(
      'members_active_requires_auth_user',
      sql`${t.status} <> 'active' OR ${t.authUserId} IS NOT NULL`
    ),
  ]
)

export const channels = pgTable(
  'channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: channelType('type').notNull(),
    name: text('name').notNull(),
    ownerMemberId: uuid('owner_member_id').references(() => members.id, {
      onDelete: 'cascade',
    }),
    status: channelStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Exactly one General channel for the whole community.
    uniqueIndex('channels_single_general_unique')
      .on(t.type)
      .where(sql`${t.type} = 'general'`),
    // At most one private channel per owning member.
    uniqueIndex('channels_one_private_per_owner_unique')
      .on(t.ownerMemberId)
      .where(sql`${t.type} = 'private'`),
    check(
      'channels_owner_matches_type',
      sql`(${t.type} = 'general' AND ${t.ownerMemberId} IS NULL) OR (${t.type} = 'private' AND ${t.ownerMemberId} IS NOT NULL)`
    ),
  ]
)

export const channelMemberships = pgTable(
  'channel_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    role: channelMemberRole('role').notNull().default('participant'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('channel_memberships_channel_member_unique').on(
      t.channelId,
      t.memberId
    ),
    index('channel_memberships_member_id_idx').on(t.memberId),
  ]
)

export const conversationThreads = pgTable(
  'conversation_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    createdByMemberId: uuid('created_by_member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('conversation_threads_channel_id_idx').on(t.channelId),
    index('conversation_threads_created_by_idx').on(t.createdByMemberId),
  ]
)

export const channelMessages = pgTable(
  'channel_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => conversationThreads.id, { onDelete: 'cascade' }),
    // Denormalized from the thread so channel-access policies never need a
    // second join; kept consistent by a CHECK-free convention plus the RLS
    // WITH CHECK (message channel must equal thread channel is enforced by
    // the insert policy in the RLS migration).
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    authorMemberId: uuid('author_member_id').references(() => members.id, {
      onDelete: 'set null',
    }),
    role: messageRole('role').notNull().default('user'),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('channel_messages_thread_id_idx').on(t.threadId),
    index('channel_messages_channel_id_idx').on(t.channelId),
    check(
      'channel_messages_user_has_author',
      sql`${t.role} <> 'user' OR ${t.authorMemberId} IS NOT NULL`
    ),
  ]
)

export const recommendations = pgTable(
  'recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: recommendationScope('scope').notNull(),
    ownerMemberId: uuid('owner_member_id').references(() => members.id, {
      onDelete: 'cascade',
    }),
    createdByMemberId: uuid('created_by_member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    ticker: text('ticker').notNull(),
    title: text('title').notNull(),
    thesis: text('thesis').notNull().default(''),
    status: recommendationStatus('status').notNull().default('active'),
    dataReliability: dataReliability('data_reliability').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('recommendations_scope_idx').on(t.scope),
    index('recommendations_owner_member_id_idx').on(t.ownerMemberId),
    index('recommendations_ticker_idx').on(t.ticker),
    check(
      'recommendations_owner_matches_scope',
      sql`(${t.scope} = 'general' AND ${t.ownerMemberId} IS NULL) OR (${t.scope} = 'member' AND ${t.ownerMemberId} IS NOT NULL)`
    ),
  ]
)

// ---------------------------------------------------------------------------
// App tables (ported from supabase/schema.sql; user_id -> member_id)
// ---------------------------------------------------------------------------

export const onboardingAnswers = pgTable('onboarding_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id')
    .notNull()
    .unique()
    .references(() => members.id, { onDelete: 'cascade' }),
  purchasingPower: text('purchasing_power').notNull(),
  industries: text('industries').array().notNull().default([]),
  watchingStocks: text('watching_stocks').array().notNull().default([]),
  riskAppetite: text('risk_appetite').notNull(),
  priority: text('priority').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    ticker: text('ticker').notNull(),
    companyName: text('company_name').notNull(),
    industry: text('industry').notNull(),
    notes: text('notes'),
    confidenceLevel: integer('confidence_level').default(3),
    addedAt: timestamp('added_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('watchlist_items_member_id_idx').on(t.memberId),
    check(
      'watchlist_items_confidence_level_range',
      sql`${t.confidenceLevel} >= 1 AND ${t.confidenceLevel} <= 5`
    ),
  ]
)

export const portfolioHoldings = pgTable(
  'portfolio_holdings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    ticker: text('ticker').notNull(),
    companyName: text('company_name').notNull(),
    shares: numeric('shares', { precision: 12, scale: 4 }).notNull(),
    avgCost: numeric('avg_cost', { precision: 12, scale: 2 }).notNull(),
    currentValue: numeric('current_value', { precision: 12, scale: 2 }),
    notes: text('notes'),
    addedAt: timestamp('added_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('portfolio_holdings_member_id_idx').on(t.memberId)]
)

export const stockAnalyses = pgTable(
  'stock_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    ticker: text('ticker').notNull(),
    companyName: text('company_name').notNull(),
    industry: text('industry').notNull(),
    metrics: jsonb('metrics').notNull().default({}),
    score: jsonb('score').notNull().default({}),
    analyzedAt: timestamp('analyzed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('stock_analyses_member_id_idx').on(t.memberId),
    index('stock_analyses_ticker_idx').on(t.ticker),
  ]
)

const DISCLAIMER =
  'This is for educational and research purposes only. Past performance does not guarantee future results. This is not financial advice.'

export const researchReports = pgTable(
  'research_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    ticker: text('ticker').notNull(),
    companyName: text('company_name').notNull(),
    industry: text('industry').notNull(),
    score: integer('score').notNull().default(0),
    overview: text('overview').notNull().default(''),
    industryPosition: text('industry_position').notNull().default(''),
    cashFlowAnalysis: text('cash_flow_analysis').notNull().default(''),
    earningsAnalysis: text('earnings_analysis').notNull().default(''),
    debtAnalysis: text('debt_analysis').notNull().default(''),
    technicalAnalysis: text('technical_analysis').notNull().default(''),
    newsSummary: text('news_summary').notNull().default(''),
    bullCase: text('bull_case').notNull().default(''),
    bearCase: text('bear_case').notNull().default(''),
    risks: text('risks').notNull().default(''),
    conclusion: text('conclusion').notNull().default(''),
    disclaimer: text('disclaimer').notNull().default(DISCLAIMER),
    generatedAt: timestamp('generated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('research_reports_member_id_idx').on(t.memberId),
    index('research_reports_ticker_idx').on(t.ticker),
  ]
)

export const optionContracts = pgTable(
  'option_contracts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticker: text('ticker').notNull(),
    optionType: text('option_type').notNull().default('CALL'),
    expirationDate: date('expiration_date').notNull(),
    strikePrice: numeric('strike_price', { precision: 10, scale: 2 }).notNull(),
    currentPremium: numeric('current_premium', {
      precision: 10,
      scale: 2,
    }).notNull(),
    allTimeHighPremium: numeric('all_time_high_premium', {
      precision: 10,
      scale: 2,
    }).notNull(),
    depreciationPct: numeric('depreciation_pct', {
      precision: 5,
      scale: 2,
    }).notNull(),
    impliedVolatility: numeric('implied_volatility', {
      precision: 5,
      scale: 4,
    }).notNull(),
    delta: numeric('delta', { precision: 5, scale: 4 }).notNull(),
    theta: numeric('theta', { precision: 8, scale: 4 }).notNull(),
    volume: integer('volume').notNull().default(0),
    openInterest: integer('open_interest').notNull().default(0),
    isMock: boolean('is_mock').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('option_contracts_ticker_idx').on(t.ticker),
    // No real options provider exists yet — the database refuses any row that
    // claims to be non-mock data. Drop this constraint only in the PR that
    // adds a genuine provider.
    check('option_contracts_mock_only', sql`${t.isMock} = true`),
  ]
)

export const leapsRecommendations = pgTable(
  'leaps_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    ticker: text('ticker').notNull(),
    companyName: text('company_name').notNull(),
    stockScore: integer('stock_score').notNull().default(0),
    recommendations: jsonb('recommendations').notNull().default([]),
    frontRunnerExplanation: text('front_runner_explanation')
      .notNull()
      .default(''),
    disclaimer: text('disclaimer').notNull().default(DISCLAIMER),
    generatedAt: timestamp('generated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('leaps_recommendations_member_id_idx').on(t.memberId),
    index('leaps_recommendations_ticker_idx').on(t.ticker),
  ]
)

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    role: text('role').notNull(),
    content: text('content').notNull(),
    contextTicker: text('context_ticker'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('chat_messages_member_id_idx').on(t.memberId),
    index('chat_messages_session_id_idx').on(t.sessionId),
    check(
      'chat_messages_role_valid',
      sql`${t.role} IN ('user', 'assistant')`
    ),
  ]
)

export const scoringConfig = pgTable('scoring_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id')
    .notNull()
    .unique()
    .references(() => members.id, { onDelete: 'cascade' }),
  weights: jsonb('weights')
    .notNull()
    .default({
      industry_leadership: 25,
      cash_flow: 20,
      earnings_quality: 20,
      debt_to_equity: 10,
      ema_distance: 15,
      option_affordability: 5,
      option_expiration: 5,
    }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
