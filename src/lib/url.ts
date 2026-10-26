/** Public base URL: APP_URL when set (custom domain), else Vercel's production URL, else local. */
export function appUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.APP_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/$/, "");
}
