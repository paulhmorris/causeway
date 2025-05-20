import { ExcelBuilder, ExcelSchemaBuilder } from "@chronicstone/typed-xlsx";
import { data, LoaderFunctionArgs } from "react-router";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { db } from "~/integrations/prisma.server";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

export const TransactionsReportSchema = z.object({
  trxStartDate: z.string(),
  trxEndDate: z.string(),
});

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);
  const { searchParams } = new URL(request.url);
  const trxStartDate = searchParams.get("trxStartDate");
  const trxEndDate = searchParams.get("trxEndDate");

  const parsedParams = TransactionsReportSchema.safeParse({ trxStartDate, trxEndDate });
  if (!parsedParams.success) {
    return data({ message: fromZodError(parsedParams.error).toString() }, { status: 400 });
  }

  const transactionItems = await db.transactionItem.findMany({
    where: {
      orgId,
      AND: [
        { transaction: { date: { gte: new Date(parsedParams.data.trxStartDate) } } },
        { transaction: { date: { lte: new Date(parsedParams.data.trxEndDate) } } },
      ],
    },
    select: {
      org: {
        select: {
          name: true,
        },
      },
      id: true,
      amountInCents: true,
      description: true,
      method: {
        select: {
          name: true,
        },
      },
      type: {
        select: {
          name: true,
        },
      },
      transaction: {
        select: {
          id: true,
          date: true,
          description: true,
          amountInCents: true,
          category: {
            select: {
              name: true,
            },
          },
          account: {
            select: {
              code: true,
              description: true,
            },
          },
          contact: {
            select: {
              organizationName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!transactionItems.length) {
    return Toasts.redirectWithError("/reports", {
      message: "No transactions found",
      description: `No transactions found from ${trxStartDate} to ${trxEndDate}. Update your date filters.`,
    });
  }

  const org = transactionItems[0].org;

  const schema = ExcelSchemaBuilder.create<(typeof transactionItems)[0]>()
    .column("Transaction ID", { key: "transaction.id" })
    .column("Transaction Description", { key: "transaction.description" })
    .column("Category", { key: "transaction.category.name" })
    .column("Item Description", { key: "description" })
    .column("Amount", {
      key: "amountInCents",
      transform: (a) => (a ? a / 100 : 0),
    })
    .column("Method", { key: "method.name" })
    .column("Type", { key: "type.name" })
    .column("Date", { key: "transaction.date" })
    .column("Account Code", { key: "transaction.account.code" })
    .column("Account Description", { key: "transaction.account.description" })
    .column("Organization", {
      key: "transaction.contact",
      transform: (c) => c?.organizationName ?? "",
    })
    .column("Contact", {
      key: "transaction.contact",
      transform: (c) => (c?.firstName || c?.lastName ? `${c.firstName} ${c.lastName}` : "N/A"),
    })
    .build();

  const file = ExcelBuilder.create()
    .sheet("Sheet1")
    .addTable({ data: transactionItems, schema })
    .build({ output: "buffer", bordered: false });

  return new Response(file, {
    headers: {
      "Content-Disposition": `attachment; filename=${org.name}-transactions-report-${parsedParams.data.trxStartDate}-${parsedParams.data.trxEndDate}.xlsx`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
