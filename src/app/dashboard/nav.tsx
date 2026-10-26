"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCode, IconInvoice, IconLink, IconOverview, IconSettings, IconWallet } from "@/components/icons";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: IconOverview, exact: true },
  { href: "/dashboard/invoices", label: "Invoices", icon: IconInvoice },
  { href: "/dashboard/links", label: "Payment links", icon: IconLink },
  { href: "/dashboard/settlement", label: "Settlement", icon: IconWallet },
  { href: "/dashboard/developers", label: "Developers", icon: IconCode },
  { href: "/dashboard/settings", label: "Settings", icon: IconSettings },
];

export function DashNav() {
  const path = usePathname();
  return (
    <nav aria-label="Dashboard">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
