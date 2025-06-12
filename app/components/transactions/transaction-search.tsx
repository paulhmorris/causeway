import { IconSearch } from "@tabler/icons-react";

import { Input } from "~/components/ui/input";
import { useDebouncedValue } from "~/hooks/useDebouncedValue";

export function TransactionSearch() {
  const [search, setSearch] = useDebouncedValue({ minLength: 2 });

  return (
    <div className="relative">
      <label htmlFor="transaction-search" className="sr-only">
        Search Transactions
      </label>
      <Input
        id="transaction-search"
        type="text"
        name="s"
        placeholder="Search by amount, e.g. 732.13"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        minLength={2}
        className="pl-10"
      />
      <IconSearch className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
    </div>
  );
}
