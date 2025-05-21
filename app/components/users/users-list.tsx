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
      className="hover:bg-muted relative flex items-center space-x-4 rounded-xl border p-4 transition-colors"
    >
      <div className="min-w-0 flex-auto">
        <h2 className="min-w-0 text-sm leading-6 font-semibold">
          <span>
            {user.contact.firstName}
            {user.contact.lastName ? ` ${user.contact.lastName}` : ""}
          </span>
        </h2>
        <div className="text-muted-foreground mt-1 flex items-center gap-x-2.5 text-xs leading-5">
          <p className="truncate">{normalizeEnum(user.role)}</p>
          <svg viewBox="0 0 2 2" className="fill-muted-foreground h-0.5 w-0.5 flex-none">
            <circle cx={1} cy={1} r={1} />
          </svg>
          <p className="whitespace-nowrap">Created {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
      <IconChevronRight className="text-muted-foreground h-5 w-5 flex-none" aria-hidden="true" />
    </Link>
  );
}

export { UserCard, UsersList };
