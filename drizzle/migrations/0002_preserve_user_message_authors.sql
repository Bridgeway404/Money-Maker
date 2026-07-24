-- Member-deletion policy (doc 03, Decision 5): members are disabled or
-- revoked, not hard-deleted. The original FKs contradicted the
-- channel_messages_user_has_author CHECK: ON DELETE SET NULL tried to null
-- the author of role='user' messages (SQLSTATE 23514 — observed in
-- validation run 30060811437), and the thread-creator CASCADE could silently
-- destroy General-channel history. Both become NO ACTION:
--  * a user message or thread that OUTLIVES its member (e.g. in General)
--    blocks hard deletion of that member (FK violation, 23503);
--  * content wholly inside the member's own private channel is still removed
--    by the channels.owner_member_id CASCADE within the same statement, so
--    deleting a member with no surviving community content keeps working
--    (NO ACTION is checked at end of statement — RESTRICT would break this).
-- Data-preserving: constraint swap only, no rows touched.
-- Rollback: re-create the constraints with the previous actions (author:
-- ON DELETE SET NULL; created_by: ON DELETE CASCADE) — but note that doing
-- so re-introduces the 23514 deletion bug this migration fixes.

ALTER TABLE "channel_messages" DROP CONSTRAINT "channel_messages_author_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "conversation_threads" DROP CONSTRAINT "conversation_threads_created_by_member_id_members_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_author_member_id_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;