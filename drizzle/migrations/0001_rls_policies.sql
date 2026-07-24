-- Row-Level Security for the IOP Investing Tool.
--
-- Design (docs/neon-migration/03-architecture-decision.md):
--  * Default deny: every table is ENABLE + FORCE ROW LEVEL SECURITY; a role
--    with no matching policy sees zero rows and writes nothing.
--  * `authenticated` / `anonymous` are the Neon Data API roles. `anonymous`
--    receives no grants at all. `authenticated` is scoped by the policies
--    below via the member linked to the Neon Auth JWT subject.
--  * The migration/owner role gets one explicit, auditable
--    `privileged_server_path` policy per table (FORCE RLS applies to the
--    owner, so its access is a declared policy rather than an implicit
--    bypass).
--  * Strict privacy model: a private channel is readable/writable by its
--    owner only. There is deliberately NO admin read path into private
--    channels.
--  * auth.user_id() is normally installed by Neon's Data API provisioning;
--    the fallback here is created only if absent and reads the same JWT
--    claim, so the RLS suite can run against a plain Postgres test branch.

CREATE SCHEMA IF NOT EXISTS auth;
--> statement-breakpoint

DO $outer$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'user_id'
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION auth.user_id() RETURNS text
      LANGUAGE sql STABLE
      AS $fn$
        SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')
      $fn$
    $create$;
  END IF;
END
$outer$;
--> statement-breakpoint

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    CREATE ROLE anonymous NOLOGIN;
  END IF;
END
$roles$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can consult `members` without
-- the caller needing broader grants; search_path pinned against hijacking)
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS iop;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION iop.current_member_id() RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT id
  FROM public.members
  WHERE auth_user_id = auth.user_id()
    AND status = 'active'
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION iop.is_active_member() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT iop.current_member_id() IS NOT NULL
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION iop.is_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members
    WHERE auth_user_id = auth.user_id()
      AND status = 'active'
      AND role = 'admin'
  )
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION iop.can_read_channel(target_channel_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = target_channel_id
      AND (
        (c.type = 'general' AND iop.is_active_member())
        OR (c.type = 'private' AND c.owner_member_id = iop.current_member_id())
      )
  )
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION iop.current_member_id() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION iop.is_active_member() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION iop.is_admin() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION iop.can_read_channel(uuid) FROM PUBLIC;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO authenticated;
--> statement-breakpoint
GRANT USAGE ON SCHEMA auth TO authenticated;
--> statement-breakpoint
GRANT USAGE ON SCHEMA iop TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth.user_id() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION iop.current_member_id() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION iop.is_active_member() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION iop.is_admin() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION iop.can_read_channel(uuid) TO authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- ENABLE + FORCE row-level security on every table (explicit, auditable)
-- ---------------------------------------------------------------------------

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.members FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.channels FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.channel_memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.channel_memberships FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.conversation_threads FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.channel_messages FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.recommendations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.onboarding_answers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.onboarding_answers FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.watchlist_items FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.portfolio_holdings FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.stock_analyses ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.stock_analyses FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.research_reports FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.option_contracts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.option_contracts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.leaps_recommendations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.leaps_recommendations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.scoring_config ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.scoring_config FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Because FORCE RLS applies to the table owner too, the migration/privileged
-- server role needs a declared policy. `current_user` here resolves at
-- migration time to the role running the migration (the same role the
-- privileged Drizzle path uses), so its access is explicit and auditable.
DO $priv$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'members',
    'channels',
    'channel_memberships',
    'conversation_threads',
    'channel_messages',
    'recommendations',
    'onboarding_answers',
    'watchlist_items',
    'portfolio_holdings',
    'stock_analyses',
    'research_reports',
    'option_contracts',
    'leaps_recommendations',
    'chat_messages',
    'scoring_config'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY privileged_server_path ON public.%I AS PERMISSIVE FOR ALL TO %I USING (true) WITH CHECK (true)',
      t, current_user
    );
  END LOOP;
END
$priv$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Grants for `authenticated` (anonymous gets nothing)
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.members TO authenticated;
--> statement-breakpoint
GRANT UPDATE (display_name) ON public.members TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
--> statement-breakpoint
GRANT SELECT ON public.channel_memberships TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_threads TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.channel_messages TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_answers TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_items TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_holdings TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_analyses TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_reports TO authenticated;
--> statement-breakpoint
GRANT SELECT ON public.option_contracts TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaps_recommendations TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scoring_config TO authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Policies for `authenticated`
-- ---------------------------------------------------------------------------

-- members: active members can see the community roster; a member may update
-- only their own row, and the column grant above limits that to display_name.
-- Invitation management (INSERT/DELETE, role/status changes) is exclusively
-- the privileged server path.
CREATE POLICY members_select_roster ON public.members
  FOR SELECT TO authenticated
  USING (iop.is_active_member());
--> statement-breakpoint
CREATE POLICY members_update_own_profile ON public.members
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.user_id() AND status = 'active')
  WITH CHECK (auth_user_id = auth.user_id() AND status = 'active');
--> statement-breakpoint

-- channels: General is visible to every active member; a private channel is
-- visible to its owner ONLY (strict privacy model — no admin read path).
CREATE POLICY channels_select_visible ON public.channels
  FOR SELECT TO authenticated
  USING (
    (type = 'general' AND iop.is_active_member())
    OR (type = 'private' AND owner_member_id = iop.current_member_id())
  );
--> statement-breakpoint
CREATE POLICY channels_insert_own_private ON public.channels
  FOR INSERT TO authenticated
  WITH CHECK (type = 'private' AND owner_member_id = iop.current_member_id());
--> statement-breakpoint
CREATE POLICY channels_update_own_private ON public.channels
  FOR UPDATE TO authenticated
  USING (type = 'private' AND owner_member_id = iop.current_member_id())
  WITH CHECK (type = 'private' AND owner_member_id = iop.current_member_id());
--> statement-breakpoint
CREATE POLICY channels_delete_own_private ON public.channels
  FOR DELETE TO authenticated
  USING (type = 'private' AND owner_member_id = iop.current_member_id());
--> statement-breakpoint

-- channel_memberships: members see their own membership rows; management is
-- the privileged server path.
CREATE POLICY channel_memberships_select_own ON public.channel_memberships
  FOR SELECT TO authenticated
  USING (member_id = iop.current_member_id());
--> statement-breakpoint

-- conversation_threads: readable wherever the channel is readable; created,
-- edited, and deleted only by their author within readable channels.
CREATE POLICY conversation_threads_select_in_channel ON public.conversation_threads
  FOR SELECT TO authenticated
  USING (iop.can_read_channel(channel_id));
--> statement-breakpoint
CREATE POLICY conversation_threads_insert_own ON public.conversation_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_member_id = iop.current_member_id()
    AND iop.can_read_channel(channel_id)
  );
--> statement-breakpoint
CREATE POLICY conversation_threads_update_own ON public.conversation_threads
  FOR UPDATE TO authenticated
  USING (created_by_member_id = iop.current_member_id() AND iop.can_read_channel(channel_id))
  WITH CHECK (created_by_member_id = iop.current_member_id() AND iop.can_read_channel(channel_id));
--> statement-breakpoint
CREATE POLICY conversation_threads_delete_own ON public.conversation_threads
  FOR DELETE TO authenticated
  USING (created_by_member_id = iop.current_member_id());
--> statement-breakpoint

-- channel_messages: readable wherever the channel is readable. Members may
-- insert only their OWN 'user' messages, into threads that belong to the
-- claimed channel. Assistant/system messages are written by the privileged
-- server path. Messages are immutable for members (no UPDATE/DELETE policy).
CREATE POLICY channel_messages_select_in_channel ON public.channel_messages
  FOR SELECT TO authenticated
  USING (iop.can_read_channel(channel_id));
--> statement-breakpoint
CREATE POLICY channel_messages_insert_own_user ON public.channel_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    role = 'user'
    AND author_member_id = iop.current_member_id()
    AND iop.can_read_channel(channel_id)
    AND EXISTS (
      SELECT 1 FROM public.conversation_threads th
      WHERE th.id = thread_id AND th.channel_id = channel_messages.channel_id
    )
  );
--> statement-breakpoint

-- recommendations: general ones are community-visible; member-scoped ones are
-- owner-only. General recommendations are managed by admins; member-scoped by
-- their owner.
CREATE POLICY recommendations_select_visible ON public.recommendations
  FOR SELECT TO authenticated
  USING (
    (scope = 'general' AND iop.is_active_member())
    OR (scope = 'member' AND owner_member_id = iop.current_member_id())
  );
--> statement-breakpoint
CREATE POLICY recommendations_insert_scoped ON public.recommendations
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_member_id = iop.current_member_id()
    AND (
      (scope = 'member' AND owner_member_id = iop.current_member_id())
      OR (scope = 'general' AND iop.is_admin())
    )
  );
--> statement-breakpoint
CREATE POLICY recommendations_update_scoped ON public.recommendations
  FOR UPDATE TO authenticated
  USING (
    (scope = 'member' AND owner_member_id = iop.current_member_id())
    OR (scope = 'general' AND iop.is_admin())
  )
  WITH CHECK (
    (scope = 'member' AND owner_member_id = iop.current_member_id())
    OR (scope = 'general' AND iop.is_admin())
  );
--> statement-breakpoint
CREATE POLICY recommendations_delete_scoped ON public.recommendations
  FOR DELETE TO authenticated
  USING (
    (scope = 'member' AND owner_member_id = iop.current_member_id())
    OR (scope = 'general' AND iop.is_admin())
  );
--> statement-breakpoint

-- option_contracts: shared read-only mock/sample data for active members.
CREATE POLICY option_contracts_select_members ON public.option_contracts
  FOR SELECT TO authenticated
  USING (iop.is_active_member());
--> statement-breakpoint

-- Member-owned app tables: full own-row CRUD, nothing else.
CREATE POLICY onboarding_answers_own ON public.onboarding_answers
  FOR ALL TO authenticated
  USING (member_id = iop.current_member_id())
  WITH CHECK (member_id = iop.current_member_id());
--> statement-breakpoint
CREATE POLICY watchlist_items_own ON public.watchlist_items
  FOR ALL TO authenticated
  USING (member_id = iop.current_member_id())
  WITH CHECK (member_id = iop.current_member_id());
--> statement-breakpoint
CREATE POLICY portfolio_holdings_own ON public.portfolio_holdings
  FOR ALL TO authenticated
  USING (member_id = iop.current_member_id())
  WITH CHECK (member_id = iop.current_member_id());
--> statement-breakpoint
CREATE POLICY stock_analyses_own ON public.stock_analyses
  FOR ALL TO authenticated
  USING (member_id = iop.current_member_id())
  WITH CHECK (member_id = iop.current_member_id());
--> statement-breakpoint
CREATE POLICY research_reports_own ON public.research_reports
  FOR ALL TO authenticated
  USING (member_id = iop.current_member_id())
  WITH CHECK (member_id = iop.current_member_id());
--> statement-breakpoint
CREATE POLICY leaps_recommendations_own ON public.leaps_recommendations
  FOR ALL TO authenticated
  USING (member_id = iop.current_member_id())
  WITH CHECK (member_id = iop.current_member_id());
--> statement-breakpoint
CREATE POLICY chat_messages_own ON public.chat_messages
  FOR ALL TO authenticated
  USING (member_id = iop.current_member_id())
  WITH CHECK (member_id = iop.current_member_id());
--> statement-breakpoint
CREATE POLICY scoring_config_own ON public.scoring_config
  FOR ALL TO authenticated
  USING (member_id = iop.current_member_id())
  WITH CHECK (member_id = iop.current_member_id());
