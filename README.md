# URL Parser CLI

A Node.js CLI that reads text, detects URLs within the outermost square brackets, fetches each URL (at most 1 per second), extracts the page `<title>`, finds the first email address (if any) and prints one JSON object per URL to stdout.

- Retries once after exactly 60 seconds on non-OK HTTP responses.
- Deduplicates already-seen URLs.
- Supports reading from a file path (relative to the script location) or from `stdin` when no file is provided.

## Requirements

- Node.js 18+ (uses the global `fetch` API)
- npm

## Install

```
npm install
```

## Quick Start

1. Create a `.env` file (see `.env.example`) and set `IM_SECRET`:

```
IM_SECRET=testsecret
```

2. Build the project:

```
npm run build
```

3. Run with the provided sample input file (includes a URL that exposes an email on the page):

```
npm run start:sample
```

You should see JSON output lines, and for `www.ingemark.com` an `email` field (HMAC-SHA256 with your `IM_SECRET`).

## Build

```
npm run build
```

## Usage

Set `IM_SECRET` in a `.env` file (already supported via `dotenv/config`) or export it in your shell. Then run:

- File mode (path is resolved relative to the script location):
  Tip: A sample file is provided under `assets/sample.txt`. After building, run:

```
npm run start:sample
```

- Stdin mode (no args):

```
npm run start:stdin
```

### Tip: Stdin mode

You can also stream input via stdin and get output incrementally:

```
echo "foo [ www.google.com ] bar" | npm run start:stdin
```

## Output

Prints one JSON line per detected URL. Fields are included only when present.

Examples:

```
{"url":"www.page.com","title":"Page Title","email":"<sha256 hmac>"}
{"url":"www.page.com","title":"Page Title"}
{"url":"www.page.com"}
```

- `email` is the HMAC-SHA256 of the first email found on the page using the `IM_SECRET` environment variable.
- Non-OK responses are retried once after 60 seconds; if the second attempt fails, the error is logged to stderr and processing continues.
- Global rate limit: maximum 1 HTTP request per second.

## Environment Variables

- `IM_SECRET`: Secret used to HMAC the first email found. If unset, `email` is omitted.

## Development

- Build the project:

```
npm run build
```

- Run all tests:

```
npm run test:all
```

- Run only parser unit tests:

```
npm run test:parser
```

- Run only CLI integration tests:
  Note: These spawn the built CLI (`dist/index.js`). If `dist` is missing, run `npm run build` first.

```
npm run test:cli
```

The test suite includes:

- Unit tests for the parser (Arrange–Act–Assert style).
- Integration tests that spawn the built CLI and hit endpoints (google.com, ingemark.com).

## Task Coverage

This implementation fulfills the requirements and bonuses:

- Detect URLs within outermost brackets with escaping and nesting rules.
- Extract title and first email (HMAC-SHA256 with `IM_SECRET`).
- One JSON output per URL; deduped; non-OK retry once after 60s; do not halt on errors.
- Bonus 1: Parser unit tests.
- Bonus 2: Integration tests for the whole script.
- Bonus 3: Stdin mode with incremental processing and exit on stream end.
