CREATE TYPE "public"."channel_member_role" AS ENUM('owner', 'participant');--> statement-breakpoint
CREATE TYPE "public"."channel_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('general', 'private');--> statement-breakpoint
CREATE TYPE "public"."data_reliability" AS ENUM('mock', 'sample', 'user_entered', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('invited', 'active', 'disabled', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."recommendation_scope" AS ENUM('general', 'member');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('active', 'closed', 'archived');--> statement-breakpoint
CREATE TABLE "channel_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"role" "channel_member_role" DEFAULT 'participant' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"author_member_id" uuid,
	"role" "message_role" DEFAULT 'user' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_messages_user_has_author" CHECK ("channel_messages"."role" <> 'user' OR "channel_messages"."author_member_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "channel_type" NOT NULL,
	"name" text NOT NULL,
	"owner_member_id" uuid,
	"status" "channel_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_owner_matches_type" CHECK (("channels"."type" = 'general' AND "channels"."owner_member_id" IS NULL) OR ("channels"."type" = 'private' AND "channels"."owner_member_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"context_ticker" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_role_valid" CHECK ("chat_messages"."role" IN ('user', 'assistant'))
);
--> statement-breakpoint
CREATE TABLE "conversation_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"created_by_member_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaps_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"company_name" text NOT NULL,
	"stock_score" integer DEFAULT 0 NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"front_runner_explanation" text DEFAULT '' NOT NULL,
	"disclaimer" text DEFAULT 'This is for educational and research purposes only. Past performance does not guarantee future results. This is not financial advice.' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text,
	"email" text NOT NULL,
	"display_name" text,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "member_status" DEFAULT 'invited' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "members_active_requires_auth_user" CHECK ("members"."status" <> 'active' OR "members"."auth_user_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "onboarding_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"purchasing_power" text NOT NULL,
	"industries" text[] DEFAULT '{}' NOT NULL,
	"watching_stocks" text[] DEFAULT '{}' NOT NULL,
	"risk_appetite" text NOT NULL,
	"priority" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_answers_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "option_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticker" text NOT NULL,
	"option_type" text DEFAULT 'CALL' NOT NULL,
	"expiration_date" date NOT NULL,
	"strike_price" numeric(10, 2) NOT NULL,
	"current_premium" numeric(10, 2) NOT NULL,
	"all_time_high_premium" numeric(10, 2) NOT NULL,
	"depreciation_pct" numeric(5, 2) NOT NULL,
	"implied_volatility" numeric(5, 4) NOT NULL,
	"delta" numeric(5, 4) NOT NULL,
	"theta" numeric(8, 4) NOT NULL,
	"volume" integer DEFAULT 0 NOT NULL,
	"open_interest" integer DEFAULT 0 NOT NULL,
	"is_mock" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "option_contracts_mock_only" CHECK ("option_contracts"."is_mock" = true)
);
--> statement-breakpoint
CREATE TABLE "portfolio_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"company_name" text NOT NULL,
	"shares" numeric(12, 4) NOT NULL,
	"avg_cost" numeric(12, 2) NOT NULL,
	"current_value" numeric(12, 2),
	"notes" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "recommendation_scope" NOT NULL,
	"owner_member_id" uuid,
	"created_by_member_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"title" text NOT NULL,
	"thesis" text DEFAULT '' NOT NULL,
	"status" "recommendation_status" DEFAULT 'active' NOT NULL,
	"data_reliability" "data_reliability" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recommendations_owner_matches_scope" CHECK (("recommendations"."scope" = 'general' AND "recommendations"."owner_member_id" IS NULL) OR ("recommendations"."scope" = 'member' AND "recommendations"."owner_member_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "research_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"company_name" text NOT NULL,
	"industry" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"overview" text DEFAULT '' NOT NULL,
	"industry_position" text DEFAULT '' NOT NULL,
	"cash_flow_analysis" text DEFAULT '' NOT NULL,
	"earnings_analysis" text DEFAULT '' NOT NULL,
	"debt_analysis" text DEFAULT '' NOT NULL,
	"technical_analysis" text DEFAULT '' NOT NULL,
	"news_summary" text DEFAULT '' NOT NULL,
	"bull_case" text DEFAULT '' NOT NULL,
	"bear_case" text DEFAULT '' NOT NULL,
	"risks" text DEFAULT '' NOT NULL,
	"conclusion" text DEFAULT '' NOT NULL,
	"disclaimer" text DEFAULT 'This is for educational and research purposes only. Past performance does not guarantee future results. This is not financial advice.' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"weights" jsonb DEFAULT '{"industry_leadership":25,"cash_flow":20,"earnings_quality":20,"debt_to_equity":10,"ema_distance":15,"option_affordability":5,"option_expiration":5}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scoring_config_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "stock_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"company_name" text NOT NULL,
	"industry" text NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"company_name" text NOT NULL,
	"industry" text NOT NULL,
	"notes" text,
	"confidence_level" integer DEFAULT 3,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_items_confidence_level_range" CHECK ("watchlist_items"."confidence_level" >= 1 AND "watchlist_items"."confidence_level" <= 5)
);
--> statement-breakpoint
ALTER TABLE "channel_memberships" ADD CONSTRAINT "channel_memberships_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_memberships" ADD CONSTRAINT "channel_memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_thread_id_conversation_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."conversation_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_author_member_id_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_owner_member_id_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaps_recommendations" ADD CONSTRAINT "leaps_recommendations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_answers" ADD CONSTRAINT "onboarding_answers_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_owner_member_id_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_reports" ADD CONSTRAINT "research_reports_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_config" ADD CONSTRAINT "scoring_config_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_analyses" ADD CONSTRAINT "stock_analyses_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_memberships_channel_member_unique" ON "channel_memberships" USING btree ("channel_id","member_id");--> statement-breakpoint
CREATE INDEX "channel_memberships_member_id_idx" ON "channel_memberships" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "channel_messages_thread_id_idx" ON "channel_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "channel_messages_channel_id_idx" ON "channel_messages" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channels_single_general_unique" ON "channels" USING btree ("type") WHERE "channels"."type" = 'general';--> statement-breakpoint
CREATE UNIQUE INDEX "channels_one_private_per_owner_unique" ON "channels" USING btree ("owner_member_id") WHERE "channels"."type" = 'private';--> statement-breakpoint
CREATE INDEX "chat_messages_member_id_idx" ON "chat_messages" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "conversation_threads_channel_id_idx" ON "conversation_threads" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "conversation_threads_created_by_idx" ON "conversation_threads" USING btree ("created_by_member_id");--> statement-breakpoint
CREATE INDEX "leaps_recommendations_member_id_idx" ON "leaps_recommendations" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "leaps_recommendations_ticker_idx" ON "leaps_recommendations" USING btree ("ticker");--> statement-breakpoint
CREATE UNIQUE INDEX "members_email_lower_unique" ON "members" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "option_contracts_ticker_idx" ON "option_contracts" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "portfolio_holdings_member_id_idx" ON "portfolio_holdings" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "recommendations_scope_idx" ON "recommendations" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "recommendations_owner_member_id_idx" ON "recommendations" USING btree ("owner_member_id");--> statement-breakpoint
CREATE INDEX "recommendations_ticker_idx" ON "recommendations" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "research_reports_member_id_idx" ON "research_reports" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "research_reports_ticker_idx" ON "research_reports" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "stock_analyses_member_id_idx" ON "stock_analyses" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "stock_analyses_ticker_idx" ON "stock_analyses" USING btree ("ticker");--> statement-breakpoint
CREATE INDEX "watchlist_items_member_id_idx" ON "watchlist_items" USING btree ("member_id");