import { NextResponse } from "next/server";
import { getPartnerRequestContext } from "@/lib/partner-api";
import { guestsForPartner } from "@/lib/partner-data";

export async function GET() {
  const context = await getPartnerRequestContext();
  if (!context) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  return NextResponse.json({ guests: await guestsForPartner(context.partnerId) });
}
