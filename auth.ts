import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { accounts, partnerUsers, sessions, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: partnerUsers,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [Resend({ apiKey: process.env.RESEND_API_KEY ?? "preview-pending", from: process.env.PARTNER_EMAIL_FROM ?? "preview-pending@jettsetglobal.com" })],
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
