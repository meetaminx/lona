"use client";

import { useEffect, useState } from "react";

/** Sticky header that gains a translucent backdrop once the page scrolls. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return <header className={`site-header2 ${scrolled ? "is-scrolled" : ""}`}>{children}</header>;
}
