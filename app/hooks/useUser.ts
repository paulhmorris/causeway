import { MembershipRole, UserRole } from "@prisma/client";

import { useOptionalUser } from "~/hooks/useOptionalUser";

export function useUser() {
  const maybeUser = useOptionalUser();

  if (!maybeUser) {
    throw new Error("useUser must be used within the _app layout.");
  }

  return {
    ...maybeUser,
    isMember: maybeUser.role === MembershipRole.MEMBER,
    isAdmin: maybeUser.role === MembershipRole.ADMIN || maybeUser.systemRole === UserRole.SUPERADMIN,
    isSuperAdmin: maybeUser.systemRole === UserRole.SUPERADMIN,
  };
}
