import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Webhook URLs are fetched by Lona's servers, so a URL pointing at a private address would let
 * anyone probe Lona's own network. Every URL is checked when it is saved and again before each
 * delivery (the second check stops a DNS record from being switched to a private address later).
 */

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

function ipv6Private(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("::ffff:")) return ipv4Private(v.slice(7));
  return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4Private(ip);
  if (kind === 6) return ipv6Private(ip);
  return true;
}

const allowPrivate = () => process.env.ALLOW_PRIVATE_WEBHOOKS === "1";

/** Returns an error message for the merchant, or null if the URL is safe to call. */
export async function checkWebhookUrl(raw: string, livemode: boolean): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Enter the full URL, starting with https://";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Use an https URL.";
  if (livemode && url.protocol !== "https:") return "Live webhooks must use https.";
  if (url.username || url.password) return "Remove the username and password from the URL.";
  if (allowPrivate()) return null;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "Webhooks need a public address. To test locally, use a tunnel such as ngrok or Cloudflare Tunnel.";
  }
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map((r) => r.address);
    } catch {
      return `We could not find ${host}. Check the domain name.`;
    }
  }
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    return "That address points to a private network. Webhooks need a public address.";
  }
  return null;
}
