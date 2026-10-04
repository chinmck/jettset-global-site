-- Global Culture Calendar: events, review queue, review history, sync runs, source health.
-- SAFE TO RE-RUN: every statement is IF NOT EXISTS / guarded / ON CONFLICT DO NOTHING, and the whole
-- file runs as ONE transaction (BEGIN..COMMIT), so a failure leaves the database unchanged. It only
-- ADDS new culture_* tables; it does not alter or drop any existing table or data.
-- Requires: migrations 0000 and 0001 already applied (needs partner_users); PostgreSQL 13+ (gen_random_uuid).
-- Apply to the production database BEFORE deploying code that reads these tables (the public API
-- and event pages fall back to the bundled snapshot if the tables are missing, but the Partner Hub
-- review area and the weekly sync need them).
BEGIN;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "culture_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"country_code" text,
	"venue" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"timezone" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"organiser" text,
	"source_name" text,
	"source_url" text,
	"source_ref" text,
	"watch_key" text,
	"last_verified_on" date,
	"last_source_check_at" timestamp with time zone,
	"editorial" jsonb,
	"editorial_reviewed_by" uuid,
	"editorial_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "culture_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"event_id" uuid,
	"watch_key" text,
	"fingerprint" text NOT NULL,
	"proposed" jsonb NOT NULL,
	"current" jsonb,
	"source_id" text,
	"source_name" text,
	"source_url" text,
	"source_ref" text,
	"source_checked_at" timestamp with time zone,
	"uncertainty" text,
	"verification_notes" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_notes" text,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "culture_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"notes" text,
	"before" jsonb,
	"after" jsonb,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "culture_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"trigger" text DEFAULT 'schedule' NOT NULL,
	"status" text NOT NULL,
	"headline" text,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "culture_source_states" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"last_attempt" timestamp with time zone,
	"last_success" timestamp with time zone,
	"last_error" text,
	"items_seen" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'culture_events_editorial_reviewed_by_partner_users_id_fk') THEN ALTER TABLE "culture_events" ADD CONSTRAINT "culture_events_editorial_reviewed_by_partner_users_id_fk" FOREIGN KEY ("editorial_reviewed_by") REFERENCES "public"."partner_users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'culture_candidates_event_id_culture_events_id_fk') THEN ALTER TABLE "culture_candidates" ADD CONSTRAINT "culture_candidates_event_id_culture_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."culture_events"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'culture_candidates_decided_by_partner_users_id_fk') THEN ALTER TABLE "culture_candidates" ADD CONSTRAINT "culture_candidates_decided_by_partner_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."partner_users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'culture_reviews_candidate_id_culture_candidates_id_fk') THEN ALTER TABLE "culture_reviews" ADD CONSTRAINT "culture_reviews_candidate_id_culture_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."culture_candidates"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'culture_reviews_reviewer_id_partner_users_id_fk') THEN ALTER TABLE "culture_reviews" ADD CONSTRAINT "culture_reviews_reviewer_id_partner_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."partner_users"("id") ON DELETE no action ON UPDATE no action; END IF; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "culture_events_slug_idx" ON "culture_events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "culture_events_status_start_idx" ON "culture_events" USING btree ("status","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "culture_candidates_fingerprint_idx" ON "culture_candidates" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "culture_candidates_status_idx" ON "culture_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "culture_reviews_candidate_idx" ON "culture_reviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "culture_sync_runs_started_idx" ON "culture_sync_runs" USING btree ("started_at");--> statement-breakpoint
-- The three events already shown on the live calendar (approved with the original mock-up). Their
-- editorial copy was written by Jettset staff tooling and is awaiting sign-off: editorial_reviewed_by
-- stays NULL, so their pages remain noindex until a staff member signs them off in the Partner Hub.
INSERT INTO "culture_events" ("slug","name","category","city","country","country_code","venue","start_date","end_date","timezone","status","organiser","source_name","source_url","watch_key","last_verified_on","editorial") VALUES
('frieze-london-2026','Frieze London','art-design-architecture','London','United Kingdom','GB','The Regent''s Park','2026-10-14','2026-10-18','Europe/London','published','Frieze','Organiser website','https://www.frieze.com/fairs/frieze-london-frieze-masters/faqs','frieze-london','2026-10-03','{"lede": "A Jettset guide to planning your journey to the fair.", "context": ["Frieze London takes place alongside Frieze Masters in The Regent''s Park, and its days draw collectors, gallerists, artists and curators to the city together. Around the fair, private views, dinners and studio visits fill the calendar, so the shape of your trip often matters more than the fair itself.", "Hotels, cars and flight slots tend to tighten in a busy week like this one. If the fair anchors your plans, it helps to settle your dates and your arrival airport before the smaller details."], "guidance": [{"title": "Dates and venue", "body": "The organiser lists Frieze London and Frieze Masters for 14–18 October 2026 at The Regent''s Park, London. Opening days, preview access and ticketing are set by Frieze, so confirm them on the official page before you travel."}, {"title": "Choosing an airport", "body": "London is served by several airports that handle private flights, including London City, Farnborough, Biggin Hill, Luton and Stansted. The right one depends on your aircraft, your timing and where you are staying, and we confirm it when we plan your journey."}, {"title": "Before you travel", "body": "Entry requirements depend on your nationality and where you are travelling from. Check the UK government''s current guidance well ahead of your departure."}], "airports": ["LCY", "FAB", "BQH", "LTN", "STN"]}'::jsonb),
('asia-now-paris-2026','Asia Now','art-design-architecture','Paris','France','FR','Monnaie de Paris','2026-10-20','2026-10-24','Europe/Paris','published','Asia Now – Paris Asian Art Fair','Organiser website','https://asianowparis.com/',NULL,'2026-10-03','{"lede": "A Jettset guide to planning your journey to the fair.", "context": ["Asia Now brings galleries and artists from across Asia and its diasporas to the Monnaie de Paris, on the Left Bank, for a week that is as much about conversation as about the work on the walls.", "It runs in the same fortnight as Art Basel Paris, so the city is full of visitors with overlapping plans. Giving your Paris days a clear order, with the fair you care most about first, makes the week easier."], "guidance": [{"title": "Dates and venue", "body": "The organiser lists Asia Now for 20–24 October 2026 at the Monnaie de Paris, with a VIP preview on Monday 19 October. Confirm access arrangements with the organiser."}, {"title": "Overlap with Art Basel Paris", "body": "Art Basel Paris is listed for 23–25 October 2026, so the two fairs overlap on 23 and 24 October. If you plan to attend both, consider which days suit each."}, {"title": "Choosing an airport", "body": "Paris Le Bourget is the airport most associated with business aviation for the city, and it is one of the airports we plan with. We confirm the best arrival airport for your aircraft and schedule when we plan your journey."}], "airports": ["LBG"]}'::jsonb),
('art-basel-paris-2026','Art Basel Paris','art-design-architecture','Paris','France','FR','Grand Palais','2026-10-23','2026-10-25','Europe/Paris','published','Art Basel','Organiser website','https://www.artbasel.com/paris','art-basel-paris','2026-10-03','{"lede": "A Jettset guide to planning your journey to the fair.", "context": ["Art Basel Paris fills the Grand Palais for the autumn art calendar''s busiest weekend in the city, and its influence spreads well beyond the fair: gallery openings, institutional shows and private dinners all cluster around it.", "For travellers, the main question is timing. Invitation previews come before the public days, and the weekend is crowded, so deciding when you need to be in Paris, and where you will base yourself, is the useful first step."], "guidance": [{"title": "Dates and venue", "body": "The organiser lists Art Basel Paris for 23–25 October 2026. Preview days, opening hours and ticketing are set by Art Basel, so check the official page for the current schedule."}, {"title": "Overlap with Asia Now", "body": "Asia Now is listed for 20–24 October 2026 at the Monnaie de Paris, so the two fairs overlap on 23 and 24 October."}, {"title": "Choosing an airport", "body": "Paris Le Bourget is the airport most associated with business aviation for the city and is one of the airports we plan with. We confirm the best arrival airport for your aircraft and schedule when we plan your journey."}], "airports": ["LBG"]}'::jsonb)
ON CONFLICT ("slug") DO NOTHING;
COMMIT;
