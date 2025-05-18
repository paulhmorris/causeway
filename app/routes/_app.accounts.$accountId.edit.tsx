import { MembershipRole } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, type MetaFunction } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { setFormDefaults, ValidatedForm, validationError } from "remix-validated-form";
import invariant from "tiny-invariant";
import { z } from "zod";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/prisma.server";
import { AccountType } from "~/lib/constants";
import { notFound } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { getAccountTypes } from "~/services.server/account";
import { SessionService } from "~/services.server/session";

const validator = withZod(
  z.object({
    id: z.string().cuid(),
    code: z.string().min(1, { message: "Code is required" }),
    description: z.string().min(1, { message: "Description is required" }),
    typeId: z.coerce.number().pipe(z.nativeEnum(AccountType)),
    userId: z.string().optional(),
  }),
);

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
    ...setFormDefaults("account-form", { ...account, userId: account.user?.id, typeId: String(account.typeId) }),
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [{ title: `Edit Account ${data?.account.code}` }];

export const action = async ({ request }: ActionFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { userId, ...data } = result.data;
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
    title: "Account updated",
    description: "Great job.",
  });
};

export default function EditAccountPage() {
  const { account, accountTypes, users } = useLoaderData<typeof loader>();
  return (
    <>
      <PageHeader title="Edit Account" />
      <PageContainer>
        <ValidatedForm id="account-form" validator={validator} method="post" className="space-y-4 sm:max-w-md">
          <input type="hidden" name="id" value={account.id} />
          <FormField label="Code" id="name" name="code" required />
          <FormField label="Description" id="name" name="description" required />
          <FormSelect
            required
            label="Type"
            name="typeId"
            placeholder="Select type"
            options={accountTypes.map((a) => ({ label: a.name, value: a.id }))}
          />
          <FormSelect
            label="Linked User"
            name="userId"
            placeholder="Select user"
            description="Link this account to a user. They will be able to see this account and all related transactions."
            options={users.map((a) => ({ label: `${a.contact.firstName} ${a.contact.lastName}`, value: a.id }))}
          />

          <ButtonGroup>
            <SubmitButton>Save</SubmitButton>
            <Button type="reset" variant="outline">
              Reset
            </Button>
          </ButtonGroup>
        </ValidatedForm>
      </PageContainer>
    </>
  );
}
