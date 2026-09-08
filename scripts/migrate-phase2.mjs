import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the Phase 2 migration.");
}

const sql = neon(databaseUrl);

await sql`
  CREATE TABLE IF NOT EXISTS "partner_notes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "enquiry_id" uuid NOT NULL REFERENCES "enquiries"("id") ON DELETE CASCADE,
    "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
    "author_id" uuid NOT NULL REFERENCES "partner_users"("id"),
    "body" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS "partner_tasks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "enquiry_id" uuid NOT NULL REFERENCES "enquiries"("id") ON DELETE CASCADE,
    "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
    "author_id" uuid NOT NULL REFERENCES "partner_users"("id"),
    "body" text NOT NULL,
    "due_date" date,
    "done" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`CREATE INDEX IF NOT EXISTS "partner_notes_partner_enquiry_idx" ON "partner_notes" ("partner_id", "enquiry_id")`;
await sql`CREATE INDEX IF NOT EXISTS "partner_notes_created_at_idx" ON "partner_notes" ("created_at")`;
await sql`CREATE INDEX IF NOT EXISTS "partner_tasks_partner_enquiry_idx" ON "partner_tasks" ("partner_id", "enquiry_id")`;
await sql`CREATE INDEX IF NOT EXISTS "partner_tasks_partner_open_due_idx" ON "partner_tasks" ("partner_id", "done", "due_date")`;

console.log("Partner Hub Phase 2 migration complete.");
