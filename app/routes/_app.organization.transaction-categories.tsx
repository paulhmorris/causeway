import { parseFormData, useForm, validationError } from "@rvf/react-router";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { ActionFunctionArgs, LoaderFunctionArgs, useFetcher, useLoaderData } from "react-router";
import { z } from "zod/v4";

import { Button } from "~/components/ui/button";
import { FormField } from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
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
    orderBy: { transactions: { _count: "desc" } },
  });

  return { categories };
}

const schema = z.object({
  categories: z.array(
    z.object({
      id: z.coerce.number().optional(),
      name: z.string().max(255).nonempty({ message: "Name is required" }),
      _count: z.object({ transactions: z.number() }).optional(),
    }),
  ),
});

export async function action({ request }: ActionFunctionArgs) {
  const orgId = await SessionService.requireOrgId(request);
  await SessionService.requireAdmin(request);
  const result = await parseFormData(request, schema);
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
    return Toasts.dataWithError(null, {
      message: "Unknown error",
      description: "Error updating transaction categories",
    });
  }
}

export default function OrganizationTransactionCategories() {
  const fetcher = useFetcher();
  const { categories } = useLoaderData<typeof loader>();
  const form = useForm({
    schema,
    fetcher,
    method: "PUT",
    defaultValues: {
      categories: categories.filter((c) => Boolean(c.orgId)),
    },
  });

  return (
    <>
      <h2 className="sr-only font-semibold">Edit Transaction Categories</h2>
      <p className="text-muted-foreground text-sm">
        Create any number of custom transaction categories for your organization. Defaults can&apos;t be changed. If a
        category already has transactions associated with it, you can&apos;t delete it.
      </p>
      <div className="mt-6">
        <form {...form.getFormProps()} className="max-w-sm">
          <span className="text-sm font-medium">Name</span>
          <ul className="flex flex-col gap-y-4">
            {form.array("categories").map((key, item, index) => {
              const prefix = `categories[${index}]`;
              const defaultValue = item.defaultValue();
              const id = categories.find((c) => c.id === defaultValue.id)?.id;
              const count = defaultValue._count;
              const trxCount = count?.transactions ?? 0;

              return (
                <li key={key} className="grid grid-cols-7 gap-x-2">
                  <div className="col-span-6">
                    {id ? <input type="hidden" name={`${prefix}.id`} value={id} /> : null}
                    <FormField
                      label="Name"
                      hideLabel
                      scope={item.scope("name")}
                      placeholder="Category name..."
                      readOnly={count ? trxCount > 0 : false}
                    />
                  </div>
                  <div className="col-span-1">
                    {}
                    {!count || trxCount === 0 ? (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => form.array("categories").remove(index)}
                        type="button"
                      >
                        <IconMinus className="size-5" />
                      </Button>
                    ) : (
                      <div className="grid size-10 place-items-center">
                        <span className="text-primary font-medium">{trxCount}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center gap-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                const nextCategoryIndex = form.array("categories").length();
                await form.array("categories").push({ id: nextCategoryIndex, name: "" });
              }}
              type="button"
            >
              <IconPlus className="size-5" />
            </Button>
          </div>
          <Button className="mt-4" type="submit" disabled={!form.formState.isDirty}>
            Save
          </Button>
        </form>
        <Separator className="my-4" />
        <h2 className="text-primary text-sm font-bold">DEFAULTS</h2>
        <ul className="mt-1 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories
            .filter((c) => c.orgId === null)
            .map((c) => (
              <li key={c.id} className="flex min-h-12 items-center justify-between rounded-sm border px-2 py-1">
                <span>{c.name}</span>
                <span className="bg-muted text-primary ml-2 flex size-5 items-center justify-center rounded-full text-xs font-medium">
                  {c._count.transactions}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </>
  );
}
