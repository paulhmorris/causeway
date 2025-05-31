import type { Prisma } from "@prisma/client";
import { Link } from "react-router";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { normalizeEnum } from "~/lib/utils";

export function UsersTable({ users }: { users: Array<Prisma.UserGetPayload<{ include: { contact: true } }>> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <span className="sr-only">Action</span>
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Username</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          return (
            <TableRow key={user.id}>
              <TableCell>
                <Link to={`/users/${user.id}/profile`} prefetch="intent" className="text-primary font-medium">
                  View
                </Link>
              </TableCell>
              <TableCell>
                <span>
                  {user.contact.firstName}
                  {user.contact.lastName ? ` ${user.contact.lastName}` : ""}
                </span>
              </TableCell>
              <TableCell>{user.username}</TableCell>
              <TableCell>{normalizeEnum(user.role)}</TableCell>
              <TableCell>{new Date(user.createdAt).toLocaleString()}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
