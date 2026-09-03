import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { partnerAup } from "@/content/partner-aup";
import { getDb } from "@/db";
import { partnerUsers } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requirePartner } from "@/lib/partner-auth";

export default async function Accept() {
  const { user } = await requirePartner({ allowUnaccepted: true });
  return <main className="partner-login"><section className="login-card">
    <span className="hub-eyebrow">First login</span><h1>{partnerAup.heading}</h1><p className="hub-lede">{partnerAup.body}</p>
    <form action={async () => { "use server"; const now = new Date(); await getDb().update(partnerUsers).set({ aupAcceptedAt: now, status: "active", updatedAt: now }).where(eq(partnerUsers.id, user.id)); await writeAudit({ actorId: user.id, action: "aup.accepted", entityType: "partner_user", entityId: user.id, after: { version: partnerAup.version, acceptedAt: now } }); redirect("/partner/dashboard"); }}>
      <label className="hub-notice"><input type="checkbox" required /> I understand and agree to these confidentiality and acceptable-use terms.</label>
      <button className="hub-button" type="submit">I agree →</button>
    </form>
  </section></main>;
}
