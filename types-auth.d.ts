import "next-auth";
declare module "next-auth" {
  interface Session { user: { id: string; email?: string | null; name?: string | null; image?: string | null; role: "partner" | "admin" | "executive"; partnerId: string | null; aupAcceptedAt: Date | null } }
  interface User { role?: "partner" | "admin" | "executive"; partnerId?: string | null; aupAcceptedAt?: Date | null }
}
