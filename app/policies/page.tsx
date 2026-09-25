import { listPayers, listPolicies } from "@/lib/repo";
import { PoliciesBrowser } from "@/components/PoliciesBrowser";

export const dynamic = "force-dynamic";

export default function PoliciesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const payers = listPayers();
  const initialFilters = {
    status: searchParams.status || "",
    impact: searchParams.impact || "",
    payerId: searchParams.payerId || "",
    category: searchParams.category || "",
  };
  const initialPolicies = listPolicies({
    status: initialFilters.status || undefined,
    impact: initialFilters.impact || undefined,
    payerId: initialFilters.payerId ? Number(initialFilters.payerId) : undefined,
    category: initialFilters.category || undefined,
  });

  return (
    <PoliciesBrowser
      payers={payers}
      initialPolicies={initialPolicies}
      initialFilters={initialFilters}
      openNew={searchParams.new === "1"}
    />
  );
}
