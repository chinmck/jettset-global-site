import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jettset Global | Private Aviation & Concierge",
  description:
    "Operator-direct private jet charter and concierge, built around the guest, not the fleet. Discreet by design.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
