// Load environment variables from .env (for IM_SECRET)
import "dotenv/config";

import fs from "fs";
import path from "path";
import {
  extractTitle,
  extractFirstEmail,
  hashEmail,
  addProtocol,
  sleep,
} from "../utils/index.js";
import { IM_SECRET } from "../config.js";

/**
 * Extract URLs within the outermost square bracket pairs.
 *
 * Rules:
 * - Only URLs inside outermost [] are considered.
 * - Escaped brackets (\\[ or \\]) are ignored for grouping.
 * - If multiple URLs exist inside a pair, only the last one is kept.
 * - Nested brackets are treated as flat within the outermost pair.
 *
 * Returns URLs in order of appearance (deduping happens at the call site).
 */
export function parseUrls(text: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let buffer = "";
  let lastChar = "";

  // Simple URL matcher that tolerates both with/without protocol
  const urlRegex = /(?:https?:\/\/|www\.)[^\s\[\]]+/gi;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    const prev = lastChar;

    // Ignore brackets that are escaped with a backslash
    const isEscapedBracket = (ch === "[" || ch === "]") && prev === "\\";

    if (ch === "[" && !isEscapedBracket) {
      depth++;
      if (depth === 1) buffer = "";
    } else if (ch === "]" && !isEscapedBracket) {
      if (depth > 0) {
        depth--;
        if (depth === 0) {
          // We just closed an outermost pair; pick the last URL inside
          let match: RegExpExecArray | null;
          let last: string | null = null;
          urlRegex.lastIndex = 0;
          while ((match = urlRegex.exec(buffer)) !== null) {
            last = match[0];
          }
          if (last) results.push(last);
        }
      }
    } else {
      if (depth >= 1) {
        if (isEscapedBracket) {
          buffer += ch;
        } else if (ch !== "[" && ch !== "]") {
          buffer += ch;
        }
      }
    }
    lastChar = ch;
  }
  return results;
}

// Fetch with a single retry after exactly 60 seconds on non-OK responses
async function fetchWithRetry(url: string): Promise<Response | null> {
  try {
    const res = await fetch(addProtocol(url));
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return res;
  } catch (err) {
    await sleep(60_000);
    try {
      const res2 = await fetch(addProtocol(url));
      if (!res2.ok) throw new Error(`Status ${res2.status}`);
      return res2;
    } catch (err2) {
      console.error(`Failed to fetch ${url}: ${err2}`);
      return null;
    }
  }
}

// Fetch, parse, and print a single URL's result as one JSON line
async function processUrl(url: string, secret?: string) {
  const res = await fetchWithRetry(url);
  if (!res) return;

  const html = await res.text();
  const title = extractTitle(html);
  const email = extractFirstEmail(html);

  const output: Record<string, string> = { url };

  if (title) output.title = title;
  if (email && secret) {
    output.email = hashEmail(email, secret);
  }

  console.log(JSON.stringify(output));
}

/**
 * CLI entrypoint.
 * - File mode when an argument is provided (resolved relative to the script).
 * - Stdin mode otherwise; processes incrementally and exits on stream end.
 *
 * Guarantees:
 * - Global 1 request/second rate limit.
 * - Deduped URLs per run.
 * - Single retry after 60s on non-OK responses.
 *
 * Reads IM_SECRET from environment (via dotenv) and prints one JSON per URL.
 */
export async function main() {
  const arg = process.argv[2];
  const secret = IM_SECRET;
  const seen = new Set<string>();

  if (arg) {
    // Resolve path relative to the script location, per task description
    const argv1 = process.argv[1] ?? ".";
    const scriptDir = path.dirname(path.resolve(argv1));
    const filePath = path.resolve(scriptDir, arg);
    let text: string;
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch (e) {
      console.error(`Failed to read input file: ${filePath} (${e})`);
      return;
    }
    const urls = parseUrls(text);

    const uniqueUrls = urls.filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });

    for (const url of uniqueUrls) {
      await processUrl(url, secret);
      await sleep(1000);
    }
  } else {
    process.stdin.setEncoding("utf8");
    let buffer = "";
    // Enforce a global 1 req/sec rate limit via a small FIFO queue
    const queue: string[] = [];
    let processing = false;
    let ended = false;

    const enqueue = (u: string) => {
      queue.push(u);
      void drain();
    };

    const drain = async () => {
      if (processing) return;
      processing = true;
      try {
        while (queue.length > 0) {
          const next = queue.shift()!;
          await processUrl(next, secret);
          await sleep(1000);
        }
      } finally {
        processing = false;
        if (ended && queue.length === 0) {
          process.exit(0);
        }
      }
    };

    // Incrementally parse and schedule newly discovered URLs
    process.stdin.on("data", (chunk) => {
      buffer += chunk;

      const urls = parseUrls(buffer);

      for (const url of urls) {
        if (!seen.has(url)) {
          seen.add(url);
          enqueue(url);
        }
      }

      const lastClose = buffer.lastIndexOf("]");
      if (lastClose !== -1) {
        buffer = buffer.slice(lastClose + 1);
      }
    });

    // Exit after the queue drains when the stream ends
    process.stdin.on("end", () => {
      ended = true;
      if (!processing && queue.length === 0) {
        process.exit(0);
      }
    });
  }
}
