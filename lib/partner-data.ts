import { and, desc, eq, sql } from "drizzle-orm";import { getDb } from "@/db";import { enquiries, partners } from "@/db/schema";
export async function partnerOverview(partnerId:string){const db=getDb();const [rows,recent,partner]=await Promise.all([
  db.select({status:enquiries.status,count:sql<number>`count(*)::int`}).from(enquiries).where(eq(enquiries.partnerId,partnerId)).groupBy(enquiries.status),
  db.select().from(enquiries).where(eq(enquiries.partnerId,partnerId)).orderBy(desc(enquiries.submittedAt)).limit(8),
  db.select().from(partners).where(eq(partners.id,partnerId)).limit(1)
]);return {counts:Object.fromEntries(rows.map(r=>[r.status,r.count])),recent,partner:partner[0]}}
export async function enquiryForPartner(id:string,partnerId:string){return (await getDb().select().from(enquiries).where(and(eq(enquiries.id,id),eq(enquiries.partnerId,partnerId))).limit(1))[0]}
