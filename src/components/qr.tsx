"use client";

import { useEffect, useState } from "react";

/** QR code rendered in the browser as SVG. */
export function Qr({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    import("qrcode").then((QR) =>
      QR.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0E1A2E", light: "#FFFFFF" } }).then((s) => {
        if (alive) setSvg(s);
      }),
    );
    return () => {
      alive = false;
    };
  }, [value]);
  return <div className="qr-box" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
