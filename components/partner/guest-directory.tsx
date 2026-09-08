"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestListItem } from "@/lib/partner-data";

const journeyLabels: Record<string, string> = {
  charter: "Charter",
  jet_card: "Jet Card",
  club_membership: "Club / Membership",
  access_partners: "Access Partners",
  general: "General",
};

type SortKey = "name" | "journeyType" | "status" | "dateIntroduced" | "email" | "phone";

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function GuestDirectory({ guests }: { guests: GuestListItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [journeyType, setJourneyType] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("dateIntroduced");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return guests
      .filter((guest) => !needle || `${guest.name} ${guest.email}`.toLocaleLowerCase().includes(needle))
      .filter((guest) => journeyType === "all" || guest.journeyType === journeyType)
      .filter((guest) => status === "all" || guest.status === status)
      .sort((a, b) => {
        const left = sortKey === "dateIntroduced" ? Date.parse(a.dateIntroduced) : String(a[sortKey]).toLocaleLowerCase();
        const right = sortKey === "dateIntroduced" ? Date.parse(b.dateIntroduced) : String(b[sortKey]).toLocaleLowerCase();
        const result = left < right ? -1 : left > right ? 1 : 0;
        return direction === "asc" ? result : -result;
      });
  }, [guests, journeyType, query, sortKey, status, direction]);

  function sortBy(next: SortKey) {
    if (sortKey === next) setDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(next);
      setDirection(next === "dateIntroduced" ? "desc" : "asc");
    }
  }

  function exportCsv() {
    const header = ["Guest name", "Email", "Phone", "Journey type", "Status", "Date introduced", "Open task count"];
    const rows = visible.map((guest) => [
      guest.name,
      guest.email,
      guest.phone,
      journeyLabels[guest.journeyType] ?? guest.journeyType,
      guest.status,
      new Date(guest.dateIntroduced).toLocaleDateString("en-GB"),
      guest.openTaskCount,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `jettset-guests-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const columns: Array<[SortKey, string]> = [
    ["name", "Guest name"], ["journeyType", "Journey"], ["status", "Stage"],
    ["dateIntroduced", "Introduced"], ["email", "Email"], ["phone", "Phone"],
  ];

  return <>
    <div className="hub-directory-tools">
      <label className="hub-search"><span>Search guests</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" /></label>
      <label><span>Journey type</span><select value={journeyType} onChange={(event) => setJourneyType(event.target.value)}><option value="all">All journeys</option>{Object.entries(journeyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All stages</option><option value="synced">Received</option><option value="pending">Pending</option><option value="failed">Needs attention</option><option value="stale">Needs attention — stale</option></select></label>
      <button className="hub-button" type="button" onClick={exportCsv} disabled={!visible.length}>Export CSV →</button>
    </div>
    <p className="hub-result-count" aria-live="polite">{visible.length} {visible.length === 1 ? "guest" : "guests"}</p>
    {visible.length ? <div className="hub-table-wrap"><table className="hub-table hub-guest-table"><thead><tr>{columns.map(([key, label]) => <th key={key}><button type="button" onClick={() => sortBy(key)}>{label}<span aria-hidden="true">{sortKey === key ? (direction === "asc" ? " ↑" : " ↓") : ""}</span></button></th>)}</tr></thead><tbody>{visible.map((guest) => <tr key={guest.id} tabIndex={0} role="link" aria-label={`View ${guest.name}`} onClick={() => router.push(`/partner/enquiries/${guest.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") router.push(`/partner/enquiries/${guest.id}`); }}><td><strong>{guest.name}</strong>{guest.openTaskCount > 0 && <span className="hub-task-count">{guest.openTaskCount} open</span>}</td><td>{journeyLabels[guest.journeyType] ?? guest.journeyType}</td><td><span className="hub-status">{guest.status === "synced" ? "received" : guest.status}</span></td><td>{new Date(guest.dateIntroduced).toLocaleDateString("en-GB")}</td><td>{guest.email || "—"}</td><td>{guest.phone || "—"}</td></tr>)}</tbody></table></div> : <div className="hub-empty">No guests match this view.</div>}
  </>;
}
