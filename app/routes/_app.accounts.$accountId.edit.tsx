import { MembershipRole } from "@prisma/client";
import { parseFormData, useForm, validationError } from "@rvf/react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { AccountType } from "~/lib/constants";
import { handleLoaderError, Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { cuid, number, optionalSelect, text } from "~/schemas/fields";
import { AccountService } from "~/services.server/account";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.AccountEdit");

const schema = z.object({
  id: cuid,
  code: text,
  description: text,
  typeId: number.pipe(z.enum(AccountType)),
  userId: optionalSelect.transform((v) => (v === "Select user" ? undefined : v)),
});

export const loader = async (args: LoaderFunctionArgs) => {
  const { params } = args;
  try {
    await SessionService.requireAdmin(args);
    const orgId = await SessionService.requireOrgId(args);

    invariant(params.accountId, "accountId not found");

    const [account, accountTypes, users] = await db.$transaction([
      db.account.findUnique({ where: { id: params.accountId, orgId }, include: { user: true } }),
      AccountService.getTypes(orgId),
      db.user.findMany({
        where: {
          memberships: {
            some: {
              orgId,
              role: { in: [MembershipRole.MEMBER, MembershipRole.ADMIN] },
            },
          },
          OR: [{ accountId: null }, { accountId: params.accountId }],
        },
        include: {
          contact: true,
        },
      }),
    ]);

    if (!account || !accountTypes.length) throw Responses.notFound({ message: "Account or Account Types not found" });

    return {
      account,
      accountTypes,
      users,
    };
  } catch (e) {
    handleLoaderError(e);
  }
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [{ title: `Edit Account ${data?.account.code}` }];

export const action = async (args: ActionFunctionArgs) => {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { userId, ...data } = result.data;

  try {
    await db.account.update({
      where: { id: data.id, orgId },
      data: {
        ...data,
        user: userId
          ? {
              connect: { id: userId },
            }
          : {
              disconnect: true,
            },
      },
    });

    return Toasts.redirectWithSuccess(`/accounts/${result.data.id}`, {
      message: "Account updated",
      description: "Great job.",
    });
  } catch (error) {
    logger.error("Error updating account", { error });
    Sentry.captureException(error);
    return Toasts.dataWithError(null, { message: "An unknown error occurred" }, { status: 500 });
  }
};

export default function EditAccountPage() {
  const { account, accountTypes, users } = useLoaderData<typeof loader>();
  const form = useForm({
    schema,
    method: "post",
    defaultValues: { ...account, userId: account.user?.id ?? "" },
  });

  return (
    <>
      <PageHeader title="Edit Account" />
      <pre className="text-xs">
        <code>{JSON.stringify(form.value(), null, 2)}</code>
      </pre>
      <PageContainer>
        <form {...form.getFormProps()} className="space-y-4 sm:max-w-md">
          <input type="hidden" name="id" value={account.id} />
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
            <SubmitButton isSubmitting={form.formState.isSubmitting}>Save</SubmitButton>
            <Button type="reset" variant="ghost">
              Reset
            </Button>
          </ButtonGroup>
        </form>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
