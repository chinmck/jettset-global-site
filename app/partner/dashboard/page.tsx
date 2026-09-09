import Link from "next/link";
import { HubNav } from "@/components/partner/hub-nav";
import { requirePartner } from "@/lib/partner-auth";
import { openTasksForPartner, partnerOverview } from "@/lib/partner-data";

export default async function Dashboard() {
  const { user } = await requirePartner();
  if (!user.partnerId && user.role === "partner") return <main className="partner-login"><p>No partner organisation has been assigned to this account.</p></main>;
  const data = user.partnerId ? await partnerOverview(user.partnerId) : { counts: { synced: 0, pending: 0, failed: 0, stale: 0 }, recent: [], partner: undefined };
  const followUps = user.partnerId ? await openTasksForPartner(user.partnerId, 8) : [];
  const totalGuests = Object.values(data.counts).reduce((sum, count) => sum + Number(count ?? 0), 0);

  return <div className="partner-shell"><HubNav role={user.role}/><main className="hub-main">
    <span className="hub-eyebrow">{data.partner?.name ?? "Jettset"}</span>
    <h1 className="hub-title">Your introductions, clearly followed.</h1>
    <p className="hub-lede">Submit new opportunities and follow the considered progress Jettset shares back with your organisation.</p>
    <section className="hub-follow-ups" aria-labelledby="follow-ups-heading">
      <div className="hub-section-head"><div><span className="hub-eyebrow">Next steps</span><h2 id="follow-ups-heading">Follow-ups due</h2></div><Link className="hub-text-link" href="/partner/guests">View all guests →</Link></div>
      {followUps.length ? <div className="hub-follow-up-list">{followUps.map((task) => <Link href={`/partner/enquiries/${task.enquiryId}`} className="hub-follow-up" key={task.id}><strong>{task.guestName}</strong><span>{task.body}</span><time>{task.dueDate ? `Due ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("en-GB")}` : "No date set"}</time></Link>)}</div> : <div className="hub-empty">Nothing outstanding — your follow-ups are clear.</div>}
    </section>
    <div className="hub-grid"><div className="hub-stat"><span>Guests introduced</span><strong>{totalGuests}</strong></div><div className="hub-stat"><span>Received</span><strong>{data.counts.synced ?? 0}</strong></div><div className="hub-stat"><span>Pending</span><strong>{data.counts.pending ?? 0}</strong></div><div className="hub-stat"><span>Needs attention</span><strong>{(data.counts.failed ?? 0) + (data.counts.stale ?? 0)}</strong></div></div>
    <section className="hub-section"><div className="hub-section-head"><h2>Recent introductions</h2><Link className="hub-button" href="/partner/enquiries/new">Submit new enquiry →</Link></div>{data.recent.length ? <div className="hub-table-wrap"><table className="hub-table"><thead><tr><th>Guest</th><th>Journey</th><th>Submitted</th><th>Status</th></tr></thead><tbody>{data.recent.map((enquiry) => <tr key={enquiry.id}><td><Link href={`/partner/enquiries/${enquiry.id}`}>{String((enquiry.payload as Record<string, unknown>).first_name ?? "Guest")} {String((enquiry.payload as Record<string, unknown>).last_name ?? "")}</Link></td><td>{enquiry.product.replaceAll("_", " ")}</td><td>{enquiry.submittedAt.toLocaleDateString("en-GB")}</td><td><span className="hub-status">{enquiry.status}</span></td></tr>)}</tbody></table></div> : <div className="hub-empty">No guests have been introduced yet.</div>}</section>
  </main></div>;
}
