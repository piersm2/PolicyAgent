import { listPayers } from "@/lib/repo";
import { checkEveryHours, listWatchPages } from "@/lib/watch";
import { aiEnabled } from "@/lib/ai";
import { usageSummary } from "@/lib/summaries";
import { WatchManager } from "@/components/WatchManager";

export const dynamic = "force-dynamic";

export default function WatchPage() {
  return (
    <WatchManager
      pages={listWatchPages()}
      payers={listPayers()}
      checkEveryHours={checkEveryHours()}
      ai={{ on: aiEnabled(), ...usageSummary().month }}
    />
  );
}
