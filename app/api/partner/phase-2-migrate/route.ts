import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";

export async function GET(request: Request) {
  const expected = process.env.GHL_CONFIRM_SECRET;
  if (!expected || new URL(request.url).searchParams.get("secret") !== expected) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const db = getDb();
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS "partner_notes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "enquiry_id" uuid NOT NULL REFERENCES "enquiries"("id") ON DELETE cascade,
    "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE cascade,
    "author_id" uuid NOT NULL REFERENCES "partner_users"("id"),
    "body" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`));
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS "partner_tasks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "enquiry_id" uuid NOT NULL REFERENCES "enquiries"("id") ON DELETE cascade,
    "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE cascade,
    "author_id" uuid NOT NULL REFERENCES "partner_users"("id"),
    "body" text NOT NULL,
    "due_date" date,
    "done" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "partner_notes_partner_enquiry_idx" ON "partner_notes" ("partner_id", "enquiry_id")`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "partner_notes_created_at_idx" ON "partner_notes" ("created_at")`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "partner_tasks_partner_enquiry_idx" ON "partner_tasks" ("partner_id", "enquiry_id")`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS "partner_tasks_partner_open_due_idx" ON "partner_tasks" ("partner_id", "done", "due_date")`));
  return NextResponse.json({ ok: true });
}
