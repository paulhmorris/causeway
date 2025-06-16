import { ExcelBuilder, ExcelSchemaBuilder } from "@chronicstone/typed-xlsx";
import { LoaderFunctionArgs } from "react-router";

import { db } from "~/integrations/prisma.server";
import { ContactType } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const _contacts = await db.contact.findMany({
    where: {
      orgId,
      typeId: { notIn: [ContactType.Staff] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      organizationName: true,
      email: true,
      alternateEmail: true,
      phone: true,
      alternatePhone: true,
      type: {
        select: {
          name: true,
        },
      },
      org: {
        select: {
          name: true,
        },
      },
      transactions: {
        select: {
          account: {
            select: {
              code: true,
              description: true,
            },
          },
        },
      },
    },
  });

  if (!_contacts.length) {
    return Toasts.redirectWithError("/reports", {
      message: "No contacts found",
      description: `No contacts found for report.`,
    });
  }

  const org = _contacts[0].org;

  const contacts = _contacts.map((c) => ({
    ...c,
    accounts: [...new Set(c.transactions.map((t) => t.account.code))].map((a) => a).join(", "),
  }));

  const schema = ExcelSchemaBuilder.create<(typeof _contacts)[0] & { accounts: string }>()
    .column("Transaction ID", { key: "id" })
    .column("Type", { key: "type.name" })
    .column("First Name", { key: "firstName" })
    .column("Last Name", { key: "lastName" })
    .column("Email", { key: "email" })
    .column("Alternate Email", { key: "alternateEmail" })
    .column("Phone", { key: "phone" })
    .column("Alternate Phone", { key: "alternatePhone" })
    .column("Organization Name", { key: "organizationName" })
    .column("Accounts Donated To", { key: "accounts" })
    .build();

  const file = ExcelBuilder.create()
    .sheet("Sheet1")
    .addTable({ data: contacts, schema })
    .build({ output: "buffer", bordered: false });

  return new Response(file, {
    headers: {
      "Content-Disposition": `attachment; filename=${org.name}-contacts-report-${new Date().getTime()}.xlsx`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
