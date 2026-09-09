import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { partners, partnerUsers } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requirePartner } from "@/lib/partner-auth";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normaliseEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  const { user: actor } = await requirePartner({ roles: ["admin", "executive"] });

  let body: { organisation_name?: unknown; contact_name?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter the partner details and try again." }, { status: 400 });
  }

  const organisationName = typeof body.organisation_name === "string" ? body.organisation_name.trim() : "";
  const contactName = typeof body.contact_name === "string" ? body.contact_name.trim() : "";
  const email = normaliseEmail(body.email);

  if (!organisationName || !contactName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid organisation, contact name and email address." }, { status: 400 });
  }

  const db = getDb();
  const [existingUser] = await db.select().from(partnerUsers).where(eq(partnerUsers.email, email)).limit(1);
  const [existingPartner] = await db.select().from(partners).where(eq(partners.email, email)).limit(1);

  if (existingUser?.partnerId && existingPartner?.id !== existingUser.partnerId) {
    return NextResponse.json(
      { error: "This email is already assigned to another partner organisation." },
      { status: 409 },
    );
  }

  const now = new Date();
  let partner = existingPartner;

  if (partner) {
    [partner] = await db
      .update(partners)
      .set({ name: organisationName, org: organisationName, status: "active", updatedAt: now })
      .where(eq(partners.id, partner.id))
      .returning();
  } else {
    [partner] = await db
      .insert(partners)
      .values({ name: organisationName, org: organisationName, email, status: "active" })
      .returning();
  }

  if (!partner) {
    return NextResponse.json({ error: "The partner organisation could not be created." }, { status: 500 });
  }

  let invitedUser = existingUser;
  if (invitedUser) {
    [invitedUser] = await db
      .update(partnerUsers)
      .set({
        partnerId: partner.id,
        name: contactName,
        role: "partner",
        status: invitedUser.aupAcceptedAt ? "active" : "pending",
        updatedAt: now,
      })
      .where(eq(partnerUsers.id, invitedUser.id))
      .returning();
  } else {
    [invitedUser] = await db
      .insert(partnerUsers)
      .values({
        partnerId: partner.id,
        name: contactName,
        email,
        role: "partner",
        status: "pending",
      })
      .returning();
  }

  if (!invitedUser) {
    return NextResponse.json({ error: "The partner account could not be created." }, { status: 500 });
  }

  await writeAudit({
    actorId: actor.id,
    action: "partner.invited",
    entityType: "partner_user",
    entityId: invitedUser.id,
    after: { partnerId: partner.id, email, organisationName },
  });

  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.PARTNER_EMAIL_FROM;
  if (!resendApiKey || !from) {
    return NextResponse.json(
      { error: "Access was created, but the invitation email service is not configured." },
      { status: 503 },
    );
  }

  const inviteUrl = new URL("/partner/login", request.nextUrl.origin);
  inviteUrl.searchParams.set("email", email);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your Jettset Partner Hub invitation",
      text: `You have been invited to the Jettset Partner Hub.\n\nOpen ${inviteUrl.toString()} and select Send secure login link.\n\nYour access is registered to ${email}.`,
      html: `<!doctype html><html><body style="background:#080808;color:#f4efe6;font-family:Arial,sans-serif;padding:40px"><div style="max-width:560px;margin:0 auto"><p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#b99a55">Jettset Partner Hub</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px">Your private access is ready.</h1><p style="color:#c8c2b8;line-height:1.6">Hello ${escapeHtml(contactName)}, you have been invited to access the Jettset Partner Hub for ${escapeHtml(organisationName)}.</p><p style="margin:32px 0"><a href="${escapeHtml(inviteUrl.toString())}" style="color:#f4efe6;border:1px solid #b99a55;padding:14px 22px;text-decoration:none;letter-spacing:.12em;text-transform:uppercase;font-size:12px">Continue to Partner Hub</a></p><p style="color:#827d75;font-size:12px;line-height:1.6">On the login page, select “Send secure login link”. The private sign-in link will be sent to ${escapeHtml(email)}.</p></div></body></html>`,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Access was created, but the invitation email could not be sent. You can try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
