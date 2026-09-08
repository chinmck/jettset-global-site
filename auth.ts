import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { accounts, partnerUsers, sessions, verificationTokens } from "@/db/schema";

function protectTokenFromQuotedPrintableDecoding(url: string) {
  return url.replace(/([?&]token=)([0-9a-f])/i, (_match, prefix: string, first: string) => {
    const encodedFirstCharacter = `%${first.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase()}`;
    return `${prefix}${encodedFirstCharacter}`;
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: DrizzleAdapter(getDb(), {
    usersTable: partnerUsers,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? "preview-pending",
      from: process.env.PARTNER_EMAIL_FROM ?? "preview-pending@jettsetglobal.com",
      async sendVerificationRequest({ identifier, provider, url }) {
        const safeUrl = protectTokenFromQuotedPrintableDecoding(url);
        const host = new URL(url).host;
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: identifier,
            subject: `Sign in to ${host}`,
            text: `Sign in to ${host}\n\n${safeUrl}\n\nIf you did not request this email, you can safely ignore it.`,
            html: `<!doctype html><html><body style="background:#080808;color:#f4efe6;font-family:Arial,sans-serif;padding:40px"><div style="max-width:560px;margin:0 auto"><p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#b99a55">Jettset Partner Hub</p><h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px">Your secure sign-in link.</h1><p style="color:#c8c2b8;line-height:1.6">Use the link below to continue to the Partner Hub.</p><p style="margin:32px 0"><a href="${escapeHtml(safeUrl)}" style="color:#f4efe6;border:1px solid #b99a55;padding:14px 22px;text-decoration:none;letter-spacing:.12em;text-transform:uppercase;font-size:12px">Sign in</a></p><p style="color:#827d75;font-size:12px;line-height:1.6">If you did not request this email, you can safely ignore it.</p></div></body></html>`,
          }),
        });
        if (!response.ok) throw new Error("Unable to send verification email");
      },
    }),
  ],
  pages: { signIn: "/partner/login" },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as typeof user & { role?: string }).role ?? "partner";
        session.user.partnerId = (user as typeof user & { partnerId?: string }).partnerId ?? null;
        session.user.aupAcceptedAt = (user as typeof user & { aupAcceptedAt?: Date }).aupAcceptedAt ?? null;
      }
      return session;
    },
  },
});
