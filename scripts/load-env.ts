// Load .env.local and .env like Next.js does, so scripts see the same settings
// (e.g. ANTHROPIC_API_KEY) as the app. Existing environment variables win.
// Import this first: settings are read when the other modules load.
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
