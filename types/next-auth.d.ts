import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      partnerId: string | null;
      aupAcceptedAt: Date | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    partnerId?: string | null;
    aupAcceptedAt?: Date | null;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role?: string;
    partnerId?: string | null;
    aupAcceptedAt?: Date | null;
  }
}
