import { GuestDirectory } from "@/components/partner/guest-directory";
import { HubNav } from "@/components/partner/hub-nav";
import { requirePartner } from "@/lib/partner-auth";
import { guestsForPartner } from "@/lib/partner-data";

export default async function GuestsPage() {
  const { user } = await requirePartner();
  const guests = user.partnerId ? await guestsForPartner(user.partnerId) : [];
  return <div className="partner-shell"><HubNav role={user.role}/><main className="hub-main"><span className="hub-eyebrow">Guest relationships</span><h1 className="hub-title">My Guests.</h1><p className="hub-lede">Every introduction, with the details and next steps kept clearly in view.</p><section className="hub-section"><GuestDirectory guests={guests}/></section></main></div>;
}
