import type { Metadata } from "next";
import { appUrl } from "@/lib/url";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import "./site.css";
import "./product.css";
import "./marketing.css";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "Lona: shielded Zcash checkout, stablecoin payouts", template: "%s | Lona" },
  description:
    "Accept payments from shielded Zcash wallets and get paid in USDC on the chain you choose. Payment links, invoices, QR checkout and webhooks.",
  openGraph: {
    title: "Lona",
    description: "Customers pay from a shielded Zcash wallet. You get paid in USDC.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
