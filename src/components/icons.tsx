// 20px line icons, 1.5px stroke, square caps (DESIGN.md section 5).
const base = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "square" as const, strokeLinejoin: "miter" as const, "aria-hidden": true };

export const IconOverview = () => (
  <svg {...base}><path d="M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z" /></svg>
);
export const IconInvoice = () => (
  <svg {...base}><path d="M5 2.5h10v15l-2-1.3-1.5 1.3-1.5-1.3-1.5 1.3L7 16.2l-2 1.3zM8 7h4M8 10h4" /></svg>
);
export const IconLink = () => (
  <svg {...base}><path d="M8.5 11.5l3-3M7 9.5l-2 2a2.5 2.5 0 003.5 3.5l2-2M13 10.5l2-2A2.5 2.5 0 0011.5 5l-2 2" /></svg>
);
export const IconWallet = () => (
  <svg {...base}><path d="M3 5.5h13v10H3zM3 5.5l9-2.5v2.5M12.5 10.5h1.5" /></svg>
);
export const IconCode = () => (
  <svg {...base}><path d="M7 6l-4 4 4 4M13 6l4 4-4 4M11 4l-2 12" /></svg>
);
export const IconSettings = () => (
  <svg {...base}><path d="M10 7.2a2.8 2.8 0 100 5.6 2.8 2.8 0 000-5.6zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" /></svg>
);
export const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>
);
