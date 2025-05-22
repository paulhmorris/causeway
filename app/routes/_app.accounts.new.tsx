import { MembershipRole } from "@prisma/client";
import { parseFormData, useForm, validationError } from "@rvf/react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { z } from "zod";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { FormField, FormSelect } from "~/components/ui/form";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { AccountType } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { getAccountTypes } from "~/services.server/account";
import { SessionService } from "~/services.server/session";

const schema = z.object({
  code: z.string().min(1, { message: "Code is required" }),
  description: z.string().min(1, { message: "Description is required" }),
  typeId: z
    .string()
    .transform((v) => +v)
    .pipe(z.nativeEnum(AccountType)),
  userId: z
    .string()
    .transform((v) => (v === "Select user" ? undefined : v))
    .optional(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  try {
    const accountTypes = await getAccountTypes(orgId);
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
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw error;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await parseFormData(request, schema);
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
    console.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError({ success: false }, { message: "Error creating account" });
  }
};

export const meta: MetaFunction = () => [{ title: "New Account" }];

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
            <Button type="reset" variant="outline">
              Reset
            </Button>
          </ButtonGroup>
        </form>
      </PageContainer>
    </>
  );
}
