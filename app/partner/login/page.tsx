import { signIn } from "@/auth";

export default async function Login({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";

  return <main className="partner-login"><section className="login-card"><span className="hub-eyebrow">Private access</span><h1>Partner Hub</h1><p className="hub-lede">Secure access for approved Jettset partners.</p><form action={async(formData)=>{"use server";await signIn("resend",{email:String(formData.get("email")),redirectTo:"/partner/dashboard"})}}><div className="hub-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required autoComplete="email" defaultValue={email}/></div><button className="hub-button" type="submit">Send secure login link →</button></form></section></main>;
}
