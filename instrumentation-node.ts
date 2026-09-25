import { startWatchScheduler } from "./lib/watch";

// Start checking watched payer pages (not while building).
if (process.env.NEXT_PHASE !== "phase-production-build") startWatchScheduler();
