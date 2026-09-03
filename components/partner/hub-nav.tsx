import Link from "next/link";
import { signOut } from "@/auth";

export function HubNav({ role }: { role: string }) {
  return <header className="hub-nav"><Link className="hub-brand" href="/partner/dashboard">Jettset Partner Hub</Link><nav className="hub-nav-links">
    <Link href="/partner/dashboard">Dashboard</Link><Link href="/partner/enquiries/new">New enquiry</Link><Link href="/partner/commission">Commission</Link><Link href="/partner/resources">Resources</Link>
    {(role === "admin" || role === "executive") && <Link href="/partner/admin">Admin</Link>}{role === "executive" && <Link href="/partner/executive">Executive</Link>}
    <form action={async()=>{"use server";await signOut({redirectTo:"/partner/login"})}}><button type="submit">Sign out</button></form>
  </nav></header>;
}
