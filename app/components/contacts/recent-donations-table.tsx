import { Prisma } from "@prisma/client";
import { Link } from "react-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { formatCentsAsDollars } from "~/lib/utils";

type Transaction = Prisma.TransactionGetPayload<{ include: { account: true } }>;
export function RecentTransactionsTable({ transactions }: { transactions: Array<Transaction> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>A list of transactions from the last 90 days</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="sr-only">Action</span>
              </TableHead>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((trx) => (
              <TableRow key={trx.id}>
                <TableCell>
                  <Link className="font-medium text-primary" to={`/transactions/${trx.id}`}>
                    View
                  </Link>
                </TableCell>
                <TableCell>{dayjs(trx.date).utc().format("MM/DD/YYYY")}</TableCell>
                <TableCell>
                  <Link className="hover:text-primary" to={`/accounts/${trx.accountId}`}>
                    {trx.account.code}
                  </Link>
                </TableCell>
                <TableCell>{formatCentsAsDollars(trx.amountInCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
