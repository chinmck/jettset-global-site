import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { partnerUsers } from "@/db/schema";

export async function getPartnerRequestContext() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user] = await getDb()
    .select()
    .from(partnerUsers)
    .where(eq(partnerUsers.id, session.user.id))
    .limit(1);

  if (!user || user.status !== "active" || !user.aupAcceptedAt || !user.partnerId) return null;
  return { session, user, partnerId: user.partnerId };
}
