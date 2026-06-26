/**
 * Runs once when a new Next.js server instance starts (before it handles any
 * requests). We use it to dump the backend environment to the logs so that
 * production config issues (wrong S3 endpoint/region, path-style, etc.) are
 * obvious from the startup output.
 *
 * @see node_modules/next/dist/docs/01-app/02-guides/instrumentation.md
 */
export async function register() {
  // Only the Node.js server runtime has the full process env; skip Edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Redact anything that looks like a credential. We log the *presence* and a
  // short fingerprint (length + last 4 chars) so misconfigured/empty secrets
  // are still diagnosable without leaking the value.
  const SECRET_RE = /(SECRET|PASSWORD|TOKEN|PRIVATE|_KEY$|^.*_KEY$|CREDENTIAL)/i;

  const redact = (key: string, value: string): string => {
    if (!SECRET_RE.test(key)) return value;
    if (value.length === 0) return "<empty>";
    return `<redacted len=${value.length} …${value.slice(-4)}>`;
  };

  const entries = Object.entries(process.env)
    .filter((e): e is [string, string] => e[1] !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  const lines = entries.map(([k, v]) => `  ${k}=${redact(k, v)}`);

  console.log(
    `[startup] backend environment (${entries.length} vars):\n${lines.join("\n")}`,
  );

  // Surface the *resolved* S3 config explicitly — these are the values the app
  // actually uses, after defaults are applied.
  console.log("[startup] resolved S3 config:", {
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000 (default)",
    region: process.env.S3_REGION || "us-east-1 (default)",
    bucket: process.env.S3_BUCKET || "images (default)",
    forcePathStyle:
      (process.env.S3_FORCE_PATH_STYLE || "false").toLowerCase() === "true",
    accessKeySet: Boolean(process.env.S3_ACCESS_KEY),
    secretKeySet: Boolean(process.env.S3_SECRET_KEY),
  });
}
