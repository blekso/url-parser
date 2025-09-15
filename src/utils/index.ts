/** Miscellaneous helpers used by the URL parser CLI */
import * as crypto from "node:crypto";

// Parse the <title>...</title> from an HTML string
export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim();
}

// Find the first email address in the HTML (very permissive regex)
export function extractFirstEmail(html: string): string | undefined {
  const match = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : undefined;
}

// HMAC-SHA256 of the email using the provided secret
export function hashEmail(email: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(email).digest("hex");
}

// Ensure we always have a protocol for fetch
export function addProtocol(url: string): string {
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

// Small utility to await a timeout (used for rate limiting and retry delays)
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
