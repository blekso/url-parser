/*
  Integration test strategy
  - We exercise the CLI as a separate process using the built entry (dist/index.js).
  - This validates real process mechanics (argv, stdin/stdout, exit code) without
    over‑mocking Node globals or refactoring the CLI to inject streams.

  Trade‑offs
  - Requires a build artifact to exist (handled by the build step in CI/scripts).
*/

import { spawn } from "child_process";
import { once } from "events";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { hashEmail } from "../src/utils/index";
import { IM_SECRET } from "../src/config";

const CLI = path.resolve(__dirname, "../dist/index.js");
// Helper: run CLI, optionally with args and stdin
async function runCli(
  args: string[] = [],
  input?: string
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  // Arrange: env for child
  const env = {
    IM_SECRET,
  };

  // Act: spawn child process to run the built CLI directly
  const child = spawn(process.execPath, [CLI, ...args], { env });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => (stdout += d.toString()));
  child.stderr.on("data", (d) => (stderr += d.toString()));

  if (input != null) {
    child.stdin.write(input);
    child.stdin.end();
  }

  const [code] = (await once(child, "close")) as [
    number | null,
    NodeJS.Signals | null
  ];
  return { code, stdout, stderr };
}

describe("CLI integration", () => {
  // Arrange: create a temporary file for file-mode test (cleaned up after)
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "url-parser-"));
  const sample = path.join(tempDir, "sample.txt");
  const googleUrl = "www.google.com";
  const ingemarkUrl = "www.ingemark.com";
  const ingemarkEmail = "hello@ingemark.com";

  beforeAll(() => {
    // Default sample content used by file-mode test
    fs.writeFileSync(
      sample,
      [
        "Text before [ www.google.com ] and after",
        "Another line [ www.ingemark.com ]",
        "Duplicate again [ www.google.com ]",
      ].join("\n"),
      "utf8"
    );
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("reads from file and prints results", async () => {
    // Act
    const { code, stdout, stderr } = await runCli([sample]);

    // Assert
    expect(code).toBe(0);
    expect(stderr).toBe("");

    const lines = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    expect(lines.length).toBe(2);
    expect(lines[0].url).toBe(googleUrl);
    expect(typeof lines[0].title).toBe("string");

    const expectedEmail = hashEmail(ingemarkEmail, IM_SECRET);
    expect(lines[1].url).toBe(ingemarkUrl);
    expect(typeof lines[1].title).toBe("string");
    expect(lines[1].email).toBe(expectedEmail);
  });

  it("reads from stdin and exits on stream end", async () => {
    // Act
    const { code, stdout, stderr } = await runCli(
      [],
      "foo [ www.google.com ] bar\n"
    );

    // Assert
    expect(code).toBe(0);
    expect(stderr).toBe("");

    const lines = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    expect(lines.length).toBe(1);
    expect(lines[0].url).toBe(googleUrl);
    expect(typeof lines[0].title).toBe("string");
  });
});
