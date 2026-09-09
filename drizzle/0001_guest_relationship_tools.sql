CREATE TABLE "partner_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"due_date" date,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_notes" ADD CONSTRAINT "partner_notes_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "partner_notes" ADD CONSTRAINT "partner_notes_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "partner_notes" ADD CONSTRAINT "partner_notes_author_id_partner_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."partner_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "partner_tasks" ADD CONSTRAINT "partner_tasks_author_id_partner_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."partner_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "partner_notes_partner_enquiry_idx" ON "partner_notes" USING btree ("partner_id","enquiry_id");
--> statement-breakpoint
CREATE INDEX "partner_notes_created_at_idx" ON "partner_notes" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "partner_tasks_partner_enquiry_idx" ON "partner_tasks" USING btree ("partner_id","enquiry_id");
--> statement-breakpoint
CREATE INDEX "partner_tasks_partner_open_due_idx" ON "partner_tasks" USING btree ("partner_id","done","due_date");
