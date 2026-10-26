/** Public business details shown on the site and legal pages. Edit before launch. */
export const SITE = {
  name: "Lona",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME ?? "Lona",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@lona.example",
  feePercent: Number(process.env.LONA_FEE_BPS ?? "50") / 100,
};
