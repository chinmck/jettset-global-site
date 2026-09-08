import type { ReactNode } from "react";
import { requirePartner } from "@/lib/partner-auth";
export default async function AdminLayout({ children }: { children: ReactNode }) { await requirePartner({ roles: ["admin", "executive"] }); return children; }
