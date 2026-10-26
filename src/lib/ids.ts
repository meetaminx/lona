import { randomBytes, createHash } from "node:crypto";

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford base32, lowercase

export function randomToken(length = 24): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}

export type IdPrefix = "mer" | "inv" | "att" | "lnk" | "key" | "whe" | "evt" | "dlv";

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${randomToken(20)}`;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Short, readable slug for payment links. */
export function newSlug(): string {
  return randomToken(10);
}
