import { Prisma } from "@prisma/client";
import { IconPlus } from "@tabler/icons-react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData, useSearchParams, useSubmit } from "react-router";

import { AccountsTable } from "~/components/accounts/accounts-table";
import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DEFAULT_PAGE_SIZE } from "~/components/ui/data-table/data-table";
import { Label } from "~/components/ui/label";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { handleLoaderError } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { AccountService } from "~/services.server/account";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.AccountIndex");

export const accountsIndexSelect: Prisma.AccountSelect = {
  id: true,
  code: true,
  isHidden: true,
  description: true,
  transactions: {
    select: {
      amountInCents: true,
    },
  },
  type: {
    select: {
      name: true,
    },
  },
};
export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const url = new URL(args.request.url);
  const take = Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);
  const skip = Number(url.searchParams.get("page") ?? 1) * take - take;

  try {
    const showHidden = new URL(args.request.url).searchParams.get("showHidden") === "true";

    const accounts = await db.account.findMany({
      where: {
        orgId,
        isHidden: showHidden ? undefined : false,
      },
      take,
      skip,
      select: accountsIndexSelect,
      orderBy: { code: "asc" },
    });

    const accountsWithBalance = accounts.map((account) => {
      const balance = account.transactions.reduce((acc, transaction) => acc + transaction.amountInCents, 0);
      return { ...account, balance };
    });

    return { accounts: accountsWithBalance };
  } catch (e) {
    handleLoaderError(e);
  }
}

export async function action(args: ActionFunctionArgs) {
  const admin = await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  try {
    const formData = await args.request.formData();
    const accountId = formData.get("accountId");
    const action = formData.get("action");

    if (typeof accountId !== "string" || typeof action !== "string") {
      logger.error("Invalid account ID or action provided", { accountId, action, orgId });
      return Toasts.dataWithError(null, {
        message: "Error hiding account",
        description: "Invalid account ID or action.",
      });
    }

    logger.info("Hiding account", { accountId, orgId, userId: admin.id });
    await AccountService.update(accountId, orgId, { isHidden: action === "hide" });
  } catch (error) {
    Sentry.captureException(error);
    logger.error("Error hiding account", { error, orgId });
    return Toasts.dataWithError(null, { message: "Error hiding account", description: "An unknown error occurred" });
  }
}

export default function AccountsIndexPage() {
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const { accounts } = useLoaderData<typeof loader>();

  return (
    <>
      <title>Accounts</title>
      <PageHeader title="Accounts">
        <Button asChild>
          <Link to="/accounts/new" prefetch="intent">
            <IconPlus className="mr-2 size-5" />
            <span>New Account</span>
          </Link>
        </Button>
      </PageHeader>

      <PageContainer>
        <Form className="mb-4 flex items-center gap-2" onChange={(e) => submit(e.currentTarget)}>
          <Label className="text-muted-foreground inline-flex cursor-pointer items-center gap-2">
            <Checkbox
              name="showHidden"
              value="true"
              aria-label="Show Hidden"
              defaultChecked={searchParams.get("showHidden") === "true"}
            />
            <span>Show Hidden</span>
          </Label>
        </Form>
        <AccountsTable data={accounts} />
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
