import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jettset Global | Private Aviation & Concierge",
  description:
    "Operator-direct private jet charter and concierge, built around the guest, not the fleet. Discreet by design.",
};

export default function Home() {
  return (
    <iframe
      className="production-homepage"
      src="/homepage.html"
      title="Jettset Global homepage"
    />
  );
}
