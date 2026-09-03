import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerUsers } from "@/db/schema";

export async function requirePartner(options?: { roles?: Array<"partner" | "admin" | "executive">; allowUnaccepted?: boolean }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/partner/login");
  const [user] = await getDb().select().from(partnerUsers).where(eq(partnerUsers.id, session.user.id)).limit(1);
  if (!user || user.status === "inactive" || (user.status === "pending" && !options?.allowUnaccepted)) redirect("/partner/login?status=inactive");
  if (!options?.allowUnaccepted && !user.aupAcceptedAt) redirect("/partner/accept");
  if (options?.roles && !options.roles.includes(user.role)) redirect("/partner/dashboard?access=denied");
  return { session, user };
}
