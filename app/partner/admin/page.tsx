import { desc } from "drizzle-orm";
import { requirePartner } from "@/lib/partner-auth";
import { HubNav } from "@/components/partner/hub-nav";
import { getDb } from "@/db";
import { enquiries, partners } from "@/db/schema";

export default async function Admin() {
  const { user } = await requirePartner({ roles: ["admin", "executive"] });
  const [partnerRows, enquiryRows] = await Promise.all([
    getDb().select().from(partners).orderBy(partners.name),
    getDb().select().from(enquiries).orderBy(desc(enquiries.submittedAt)).limit(50),
  ]);
  return <div className="partner-shell"><HubNav role={user.role}/><main className="hub-main">
    <span className="hub-eyebrow">Jettset administration</span><h1 className="hub-title">Partner operations.</h1>
    <div className="hub-grid"><div className="hub-stat"><span>Partners</span><strong>{partnerRows.length}</strong></div><div className="hub-stat"><span>Submissions</span><strong>{enquiryRows.length}</strong></div><div className="hub-stat"><span>Pending CRM</span><strong>{enquiryRows.filter(e=>e.status==="pending").length}</strong></div><div className="hub-stat"><span>Needs attention</span><strong>{enquiryRows.filter(e=>e.status==="failed"||e.status==="stale").length}</strong></div></div>
    <section className="hub-section"><h2>Partner organisations</h2><table className="hub-table"><thead><tr><th>Partner</th><th>Status</th><th>Commission</th></tr></thead><tbody>{partnerRows.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.status}</td><td>{p.commissionRate===null?"Pending":`${p.commissionRate}%`}</td></tr>)}</tbody></table></section>
    <section className="hub-section"><h2>CRM sync</h2><table className="hub-table"><thead><tr><th>Correlation</th><th>Product</th><th>Submitted</th><th>Status</th></tr></thead><tbody>{enquiryRows.map(e=><tr key={e.id}><td>{e.correlationId.slice(0,8)}</td><td>{e.product}</td><td>{e.submittedAt.toLocaleString("en-GB")}</td><td className="hub-status">{e.status}</td></tr>)}</tbody></table></section>
  </main></div>;
}
