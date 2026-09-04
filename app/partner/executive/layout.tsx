import type { ReactNode } from "react";
import { requirePartner } from "@/lib/partner-auth";
export default async function ExecutiveLayout({ children }: { children: ReactNode }) { await requirePartner({ roles: ["executive"] }); return children; }
