import { listPayers, listPolicies } from "@/lib/repo";
import { PoliciesBrowser } from "@/components/PoliciesBrowser";

export const dynamic = "force-dynamic";

export default function PoliciesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const initialFilters = {
    payerId: searchParams.payerId || "",
    category: searchParams.category || "",
  };
  const initialPolicies = listPolicies({
    payerId: initialFilters.payerId ? Number(initialFilters.payerId) : undefined,
    category: initialFilters.category || undefined,
  });

  return (
    <PoliciesBrowser
      payers={listPayers()}
      initialPolicies={initialPolicies}
      initialFilters={initialFilters}
      openNew={searchParams.new === "1"}
    />
  );
}
