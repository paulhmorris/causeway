import { MembershipRole, UserRole } from "@prisma/client";
import { useNavigate } from "react-router";

import { useOptionalUser } from "~/hooks/useOptionalUser";

export function useUser() {
  const maybeUser = useOptionalUser();
  const navigate = useNavigate();

  if (!maybeUser) {
    void navigate("/login");
    return undefined as never;
  }

  if (!maybeUser.role) {
    throw new Error("User has no role in root loader.");
  }

  return {
    ...maybeUser,
    isMember: maybeUser.role === MembershipRole.MEMBER,
    isAdmin: maybeUser.role === MembershipRole.ADMIN || maybeUser.systemRole === UserRole.SUPERADMIN,
    isSuperAdmin: maybeUser.systemRole === UserRole.SUPERADMIN,
  } as Omit<typeof maybeUser, "role"> & {
    role: MembershipRole;
    isMember: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  };
}
