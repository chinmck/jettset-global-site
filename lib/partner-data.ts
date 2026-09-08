import { and, asc, desc, eq, sql } from "drizzle-orm";import { getDb } from "@/db";import { enquiries, partnerTasks, partners } from "@/db/schema";
export async function partnerOverview(partnerId:string){const db=getDb();const [rows,recent,partner]=await Promise.all([
  db.select({status:enquiries.status,count:sql<number>`count(*)::int`}).from(enquiries).where(eq(enquiries.partnerId,partnerId)).groupBy(enquiries.status),
  db.select().from(enquiries).where(eq(enquiries.partnerId,partnerId)).orderBy(desc(enquiries.submittedAt)).limit(8),
  db.select().from(partners).where(eq(partners.id,partnerId)).limit(1)
]);return {counts:Object.fromEntries(rows.map(r=>[r.status,r.count])),recent,partner:partner[0]}}
export async function enquiryForPartner(id:string,partnerId:string){return (await getDb().select().from(enquiries).where(and(eq(enquiries.id,id),eq(enquiries.partnerId,partnerId))).limit(1))[0]}

export type GuestListItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  journeyType: string;
  status: string;
  dateIntroduced: string;
  openTaskCount: number;
};

function payloadText(payload: unknown, ...keys: string[]) {
  const source = (payload ?? {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function guestFromEnquiry(row: typeof enquiries.$inferSelect & { openTaskCount?: number }): GuestListItem {
  const first = payloadText(row.payload, "first_name", "firstName", "name");
  const last = payloadText(row.payload, "last_name", "lastName");
  return {
    id: row.id,
    name: [first, last].filter(Boolean).join(" ") || "Guest",
    email: payloadText(row.payload, "email"),
    phone: payloadText(row.payload, "phone", "telephone", "mobile"),
    journeyType: row.product,
    status: row.status,
    dateIntroduced: row.submittedAt.toISOString(),
    openTaskCount: Number(row.openTaskCount ?? 0),
  };
}

export async function guestsForPartner(partnerId: string) {
  const rows = await getDb()
    .select({
      enquiry: enquiries,
      openTaskCount: sql<number>`count(${partnerTasks.id}) filter (where ${partnerTasks.done} = false)::int`,
    })
    .from(enquiries)
    .leftJoin(partnerTasks, and(eq(partnerTasks.enquiryId, enquiries.id), eq(partnerTasks.partnerId, partnerId)))
    .where(eq(enquiries.partnerId, partnerId))
    .groupBy(enquiries.id)
    .orderBy(desc(enquiries.submittedAt));

  return rows.map(({ enquiry, openTaskCount }) => guestFromEnquiry({ ...enquiry, openTaskCount }));
}

export async function openTasksForPartner(partnerId: string, limit = 8) {
  const rows = await getDb()
    .select({ task: partnerTasks, enquiry: enquiries })
    .from(partnerTasks)
    .innerJoin(enquiries, and(eq(enquiries.id, partnerTasks.enquiryId), eq(enquiries.partnerId, partnerId)))
    .where(and(eq(partnerTasks.partnerId, partnerId), eq(partnerTasks.done, false)))
    .orderBy(sql`${partnerTasks.dueDate} asc nulls last`, asc(partnerTasks.createdAt))
    .limit(limit);

  return rows.map(({ task, enquiry }) => ({
    ...task,
    guestName: guestFromEnquiry(enquiry).name,
  }));
}
