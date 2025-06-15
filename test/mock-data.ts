import { MembershipRole, UserRole } from "@prisma/client";

export const MOCK_DATA = {
  user: {
    id: "cmagnqeof0003t21kbps553kq",
    username: "test@example.com",
    role: MembershipRole.ADMIN,
    systemRole: UserRole.ADMIN,
    contactAssignments: [],
    contact: {
      id: "cmagnqeog0005t21kq9mv4vvb",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      typeId: 5,
      accountSubscriptions: [
        {
          accountId: "cmagnqept000mt21knm5wk5nn",
        },
        {
          accountId: "cmagnqept000nt21k5sns5oyb",
        },
        {
          accountId: "cmagnqept000lt21kjnpz9vzs",
        },
        {
          accountId: "cmay6v7p50003q0gycsvsho3w",
        },
      ],
    },
    memberships: [
      {
        role: MembershipRole.ADMIN,
        isDefault: false,
        orgId: "cmagnqem30001t21kfdciyqta",
        org: {
          name: "Test Org 1",
        },
      },
      {
        role: MembershipRole.ADMIN,
        isDefault: false,
        orgId: "cmagnqem40002t21k7wxd4kox",
        org: {
          name: "Test Org 2",
        },
      },
    ],
    org: {
      id: "cmagnqem30001t21kfdciyqta",
      name: "Test Org 1",
    },
    isMember: false,
    isAdmin: true,
    isSuperAdmin: true,
  },
};
