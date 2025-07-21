import { MembershipRole } from "@prisma/client";
import { parseFormData, useForm, validationError } from "@rvf/react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { FormField, FormSelect } from "~/components/ui/form";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { AccountType } from "~/lib/constants";
import { handleLoaderError } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { number, optionalSelect, text } from "~/schemas/fields";
import { AccountService } from "~/services.server/account";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.AccountNew");

const schema = z.object({
  code: text,
  description: text,
  typeId: number.pipe(z.enum(AccountType)),
  userId: optionalSelect.transform((v) => (v === "Select user" ? undefined : v)),
});

export const loader = async (args: LoaderFunctionArgs) => {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  try {
    const accountTypes = await AccountService.getTypes(orgId);
    const users = await db.user.findMany({
      where: {
        memberships: {
          some: {
            orgId,
            role: { in: [MembershipRole.MEMBER, MembershipRole.ADMIN] },
          },
        },
        accountId: null,
      },
      select: {
        id: true,
        contact: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      users,
      accountTypes,
    };
  } catch (e) {
    handleLoaderError(e);
  }
};

export const action = async (args: ActionFunctionArgs) => {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { userId, ...data } = result.data;
  try {
    const account = await db.account.create({
      data: {
        ...data,
        orgId,
        user: {
          connect: userId ? { id: userId } : undefined,
        },
      },
    });

    return Toasts.redirectWithSuccess(`/accounts/${account.id}`, {
      message: "Account created",
      description: "Well done.",
    });
  } catch (error) {
    logger.error("Error creating account", { error });
    Sentry.captureException(error);
    return Toasts.dataWithError({ success: false }, { message: "Error creating account" });
  }
};

export default function NewAccountPage() {
  const { users, accountTypes } = useLoaderData<typeof loader>();
  const form = useForm({
    schema,
    method: "POST",
    defaultValues: {
      code: "",
      userId: "",
      typeId: "",
      description: "",
    },
  });
  return (
    <>
      <title>New Account</title>
      <PageHeader title="New Account" />
      <PageContainer>
        <form {...form.getFormProps()} className="space-y-4 sm:max-w-md">
          <FormField label="Code" scope={form.scope("code")} required />
          <FormField label="Description" scope={form.scope("description")} required />
          <FormSelect
            required
            label="Type"
            scope={form.scope("typeId")}
            placeholder="Select type"
            options={accountTypes.map((a) => ({ label: a.name, value: a.id }))}
          />
          <FormSelect
            label="Linked User"
            scope={form.scope("userId")}
            placeholder="Select user"
            description="Link this account to a user. They will be able to see this account and all related transactions."
            options={users.map((a) => ({ label: `${a.contact.firstName} ${a.contact.lastName}`, value: a.id }))}
          />

          <ButtonGroup>
            <Button>Create Account</Button>
            <Button type="reset" variant="ghost">
              Reset
            </Button>
          </ButtonGroup>
        </form>
      </PageContainer>
    </>
  );
}
