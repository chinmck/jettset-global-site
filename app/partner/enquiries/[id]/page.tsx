import Link from "next/link";
import { notFound } from "next/navigation";
import { GuestRelationship } from "@/components/partner/guest-relationship";
import { HubNav } from "@/components/partner/hub-nav";
import { requirePartner } from "@/lib/partner-auth";
import { enquiryForPartner } from "@/lib/partner-data";

function text(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "—";
}

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePartner();
  if (!user.partnerId) notFound();
  const enquiry = await enquiryForPartner((await params).id, user.partnerId);
  if (!enquiry) notFound();
  const payload = enquiry.payload as Record<string, unknown>;
  const name = [text(payload, "first_name", "firstName", "name"), text(payload, "last_name", "lastName")].filter((part) => part !== "—").join(" ") || "Guest";

  return <div className="partner-shell"><HubNav role={user.role}/><main className="hub-main">
    <Link className="hub-back-link" href="/partner/guests">← Back to My Guests</Link>
    <span className="hub-eyebrow">{enquiry.product.replaceAll("_", " ")}</span>
    <h1 className="hub-title">{name}</h1>
    <div className="hub-panel hub-guest-summary">
      <p><span className="hub-muted">Current status</span><br/><strong className="hub-status">{enquiry.status}</strong></p>
      <p><span className="hub-muted">Journey</span><br/>{text(payload, "origin", "departure_airport")} → {text(payload, "destination", "arrival_airport")}</p>
      <p><span className="hub-muted">Submitted</span><br/>{enquiry.submittedAt.toLocaleString("en-GB")}</p>
      <p><span className="hub-muted">Email</span><br/>{text(payload, "email")}</p>
      <p><span className="hub-muted">Phone</span><br/>{text(payload, "phone", "telephone", "mobile")}</p>
      <p className="hub-summary-notes"><span className="hub-muted">Journey notes</span><br/>{text(payload, "notes", "requirements", "message")}</p>
    </div>
    <GuestRelationship enquiryId={enquiry.id}/>
  </main></div>;
}
