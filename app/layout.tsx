import type { Metadata } from "next";
import Script from "next/script";
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
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-18409587176"
        strategy="afterInteractive"
      />
      <Script id="google-ads-base-tag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', 'AW-18409587176');
        `}
      </Script>
    </html>
  );
}
