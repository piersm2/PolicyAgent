// Runs once when the Next.js server starts. The import must sit inside this
// check so the Node-only code is left out of the edge-runtime build.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
