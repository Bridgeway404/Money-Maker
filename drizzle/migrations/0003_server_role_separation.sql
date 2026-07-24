-- Server-role separation + auth.user_id() hardening.
--
-- Findings from validation run 30061768777 (Neon development branch):
--  * The Neon connection/owner role (neondb_owner) carries BYPASSRLS
--    (rolsuper=false, rolbypassrls=true, rolcreaterole=true). That is how
--    Neon provisions the owner; it is fine for migrations and emergency
--    admin, but it means owner-path operations prove NOTHING about RLS
--    policies, and owner credentials must never serve member-owned CRUD.
--  * auth.user_id() as created by the 0001 fallback cast the claims GUC to
--    json BEFORE null-checking. After a transaction-local
--    set_config('request.jwt.claims', ..., true) is rolled back, the GUC's
--    session reset value is the empty string '' — and ''::json raises
--    SQLSTATE 22P02, breaking any policy evaluation on that connection.
--
-- This migration:
--  1. Redefines auth.user_id() to nullif the raw text FIRST. Semantically
--     identical to the Data API convention (sub claim of
--     request.jwt.claims); safe to CREATE OR REPLACE.
--  2. Creates iop_server: the limited server-job role — NOLOGIN,
--     NOSUPERUSER, NOBYPASSRLS — with explicit table grants and explicit
--     `server_job_path` policies. FORCE RLS applies to it, so its access is
--     a declared policy, not a bypass. The migration/owner role is granted
--     membership so server processes can `SET ROLE iop_server` for
--     scheduled jobs and controlled admin, instead of acting as the
--     BYPASSRLS owner.
--
-- No role receives BYPASSRLS. Rollback note: DROP the server_job_path
-- policies, REVOKE the grants, DROP ROLE iop_server, and (if ever needed)
-- restore the previous auth.user_id() body — though that reintroduces the
-- 22P02 defect this migration fixes.

CREATE OR REPLACE FUNCTION auth.user_id() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::json->>'sub'
$$;
--> statement-breakpoint

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iop_server') THEN
    CREATE ROLE iop_server NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$role$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO iop_server;
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.members,
  public.channels,
  public.channel_memberships,
  public.conversation_threads,
  public.channel_messages,
  public.recommendations,
  public.onboarding_answers,
  public.watchlist_items,
  public.portfolio_holdings,
  public.stock_analyses,
  public.research_reports,
  public.option_contracts,
  public.leaps_recommendations,
  public.chat_messages,
  public.scoring_config
TO iop_server;
--> statement-breakpoint

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
      'CREATE POLICY server_job_path ON public.%I AS PERMISSIVE FOR ALL TO iop_server USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END
$priv$;
--> statement-breakpoint

-- Let the migration/owner role assume iop_server for jobs and controlled
-- admin (SET ROLE), so server code need not run as the BYPASSRLS owner.
DO $grant$
BEGIN
  EXECUTE format('GRANT iop_server TO %I', current_user);
END
$grant$;
