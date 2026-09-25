import { listPayersWithCounts } from "@/lib/repo";
import { PayersManager } from "@/components/PayersManager";

export const dynamic = "force-dynamic";

export default function PayersPage() {
  return <PayersManager initial={listPayersWithCounts()} />;
}
