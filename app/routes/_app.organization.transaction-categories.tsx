import { useFieldArray, ValidatedForm, validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { nanoid } from "nanoid";
import { ActionFunctionArgs, LoaderFunctionArgs, useFetcher, useLoaderData } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { FormField } from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

export async function loader({ request }: LoaderFunctionArgs) {
  const orgId = await SessionService.requireOrgId(request);
  await SessionService.requireAdmin(request);
  const categories = await db.transactionCategory.findMany({
    where: {
      OR: [{ orgId }, { orgId: null }],
    },
    include: {
      _count: {
        select: { transactions: true },
      },
    },
    orderBy: { transactions: { _count: "asc" } },
  });

  return {
    categories,
    // ...setFormDefaults("categories-form", {
    //   categories: categories.filter((c) => Boolean(c.orgId)),
    // }),
  };
}

const validator = withZod(
  z.object({
    categories: z.array(
      z.object({
        id: z.coerce.number().optional(),
        name: z.string().max(255).nonempty({ message: "Name is required" }),
      }),
    ),
  }),
);

export async function action({ request }: ActionFunctionArgs) {
  const orgId = await SessionService.requireOrgId(request);
  await SessionService.requireAdmin(request);
  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { categories } = result.data;
  const current = await db.transactionCategory.findMany({
    where: { orgId: { not: null } },
  });

  const create = categories.filter((t) => t.id === undefined) as Array<{ name: string }>;
  const keep = categories.filter((t) => t.id !== undefined) as Array<{ id: number; name: string }>;
  const _delete = current.filter((t) => !keep.some((k) => k.id === t.id)).map((t) => t.id);

  try {
    await db.$transaction([
      db.transactionCategory.createMany({
        data: create.map((t) => ({
          name: t.name,
          orgId,
        })),
      }),
      db.transactionCategory.deleteMany({
        where: {
          id: { in: _delete },
          orgId,
        },
      }),
      ...keep.map((t) =>
        db.transactionCategory.update({
          where: {
            id: t.id,
            orgId,
          },
          data: { name: t.name },
        }),
      ),
    ]);

    return Toasts.dataWithSuccess(null, { message: "Transaction categories updated" });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError(null, { message: "Error updating transaction categories" });
  }
}

export default function OrganizationTransactionCategories() {
  const fetcher = useFetcher();
  const { categories } = useLoaderData<typeof loader>();
  const [items, { push, remove }] = useFieldArray<(typeof categories)[number]>("categories", {
    formId: "categories-form",
  });

  return (
    <>
      <h2 className="sr-only font-semibold">Edit Transaction Categories</h2>
      <p className="text-sm text-muted-foreground">
        Create any number of custom transaction categories for your organization. Defaults can&apos;t be changed. If a
        category already has transactions associated with it, you can&apos;t delete it.
      </p>
      <div className="mt-6">
        <ValidatedForm fetcher={fetcher} id="categories-form" method="PUT" validator={validator} className="max-w-sm">
          <span className="text-sm font-medium">Name</span>
          <ul className="flex flex-col gap-y-4">
            {items.map((i, index) => {
              const prefix = `categories[${index}]`;
              const id = categories.find((c) => c.id === i.defaultValue.id)?.id;

              return (
                <li key={i.key} className="grid grid-cols-7 gap-x-2">
                  <div className="col-span-6">
                    {id ? <input type="hidden" name={`${prefix}.id`} value={i.defaultValue.id} /> : null}
                    <FormField
                      label="Name"
                      hideLabel
                      name={`${prefix}.name`}
                      placeholder="Category name..."
                       
                      readOnly={i.defaultValue._count ? i.defaultValue._count.transactions > 0 : false}
                    />
                  </div>
                  <div className="col-span-1">
                    { }
                    {!i.defaultValue._count || i.defaultValue._count?.transactions === 0 ? (
                      <Button variant="outline" size="icon" onClick={() => remove(index)} type="button">
                        <IconMinus className="size-5" />
                      </Button>
                    ) : (
                      <div className="grid size-10 place-items-center">
                        <span className="font-medium text-primary">{i.defaultValue._count.transactions}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center gap-x-2">
            <Button variant="outline" size="icon" onClick={() => push({ id: nanoid() })} type="button">
              <IconPlus className="size-5" />
            </Button>
          </div>
          <SubmitButton formId="categories-form" className="mt-4">
            Save
          </SubmitButton>
        </ValidatedForm>
        <Separator className="my-4" />
        <h2 className="text-sm font-bold text-primary">DEFAULTS</h2>
        <ul className="mt-1 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories
            .filter((c) => c.orgId === null)
            .map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-sm border px-2 py-1">
                <span>{c.name}</span>
                <span className="ml-2 flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium text-primary">
                  {c._count.transactions}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </>
  );
}
