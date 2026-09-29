import { startWatchScheduler } from "./lib/watch";
import { kickImportWorker } from "./lib/history";

// Start checking watched payer pages and resume any queued historical import
// (not while building).
if (process.env.NEXT_PHASE !== "phase-production-build") {
  startWatchScheduler();
  setTimeout(kickImportWorker, 20_000).unref();
}
