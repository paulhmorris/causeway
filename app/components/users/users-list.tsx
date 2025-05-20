import type { Prisma } from "@prisma/client";
import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "react-router";

import { normalizeEnum } from "~/lib/utils";

type UserWithContact = Prisma.UserGetPayload<{ include: { contact: true } }>;

function UsersList({ users }: { users: Array<UserWithContact> }) {
  return (
    <div>
      <h2 className="mb-2">Users</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            <UserCard {...user} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function UserCard(user: UserWithContact) {
  return (
    <Link
      to={`/users/${user.id}`}
      className="relative flex items-center space-x-4 rounded-xl border p-4 transition-colors hover:bg-muted"
    >
      <div className="min-w-0 flex-auto">
        <h2 className="min-w-0 text-sm font-semibold leading-6">
          <span>
            {user.contact.firstName}
            {user.contact.lastName ? ` ${user.contact.lastName}` : ""}
          </span>
        </h2>
        <div className="mt-1 flex items-center gap-x-2.5 text-xs leading-5 text-muted-foreground">
          <p className="truncate">{normalizeEnum(user.role)}</p>
          <svg viewBox="0 0 2 2" className="h-0.5 w-0.5 flex-none fill-muted-foreground">
            <circle cx={1} cy={1} r={1} />
          </svg>
          <p className="whitespace-nowrap">Created {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
      <IconChevronRight className="h-5 w-5 flex-none text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

export { UserCard, UsersList };
