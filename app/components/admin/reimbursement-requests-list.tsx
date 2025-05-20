import { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import { Link } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { useUser } from "~/hooks/useUser";
import { formatCentsAsDollars } from "~/lib/utils";

type ReimbursementRequest = Prisma.ReimbursementRequestGetPayload<{
  include: { user: { include: { contact: true } }; account: true };
}>;
export function ReimbursementRequestsList({ requests }: { requests: Array<ReimbursementRequest> }) {
  const user = useUser();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pending Reimbursement Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Submitted</TableHead>
                {!user.isMember ? <TableHead>User</TableHead> : null}
                <TableHead className="hidden lg:table-cell">Account</TableHead>
                <TableHead>Amount</TableHead>
                {!user.isMember ? (
                  <TableHead>
                    <span className="sr-only">Action</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{dayjs(req.createdAt).format("M/DD/YY h:mm a")}</TableCell>
                  {!user.isMember ? <TableCell>{req.user.contact.email}</TableCell> : null}
                  <TableCell className="hidden lg:table-cell">{req.account.code}</TableCell>
                  <TableCell>{formatCentsAsDollars(req.amountInCents)}</TableCell>
                  {!user.isMember ? (
                    <TableCell>
                      <Link to={`/reimbursements/${req.id}`} className="font-medium text-primary">
                        View
                      </Link>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
