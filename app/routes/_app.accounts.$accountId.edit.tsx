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
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { AccountType } from "~/lib/constants";
import { notFound } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { cuid, number, optionalSelect, text } from "~/schemas/fields";
import { getAccountTypes } from "~/services.server/account";
import { SessionService } from "~/services.server/session";

const schema = z.object({
  id: cuid,
  code: text,
  description: text,
  typeId: number.pipe(z.enum(AccountType)),
  userId: optionalSelect.transform((v) => (v === "Select user" ? undefined : v)),
});

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  invariant(params.accountId, "accountId not found");

  const [account, accountTypes, users] = await Promise.all([
    db.account.findUnique({ where: { id: params.accountId, orgId }, include: { user: true } }),
    getAccountTypes(orgId),
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

  if (!account || !accountTypes.length) throw notFound({ message: "Account or Account Types not found" });

  return {
    account,
    accountTypes,
    users,
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [{ title: `Edit Account ${data?.account.code}` }];

export const action = async ({ request }: ActionFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await parseFormData(request, schema);
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
    console.error(error);
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
            <SubmitButton disabled={!form.formState.isDirty} isSubmitting={form.formState.isSubmitting}>
              Save
            </SubmitButton>
            <Button type="reset" variant="outline">
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
