import { listPayers } from "@/lib/repo";
import { checkEveryHours, listWatchPages } from "@/lib/watch";
import { WatchManager } from "@/components/WatchManager";

export const dynamic = "force-dynamic";

export default function WatchPage() {
  return <WatchManager pages={listWatchPages()} payers={listPayers()} checkEveryHours={checkEveryHours()} />;
}
