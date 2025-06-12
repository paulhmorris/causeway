import { FormScope } from "@rvf/react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { FormField, FormSelect } from "~/components/ui/form";

type Props = {
  title: string;
  fieldPrefix: string;
  itemScope: FormScope<{
    typeId: "";
    methodId: "";
    amountInCents: "";
    description?: string | undefined;
  }>;
  trxItemMethods: Array<{ id: number; name: string }>;
  trxItemTypes: Array<{ id: number; name: string }>;
  removeItemHandler: () => void;
};

export function TransactionItem({
  title,
  fieldPrefix,
  itemScope,
  removeItemHandler,
  trxItemMethods,
  trxItemTypes,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <input type="hidden" name={`${fieldPrefix}.id`} />
        <fieldset className="space-y-3">
          <div className="grid grid-cols-10 items-start gap-2">
            <div className="col-span-3 sm:col-span-2">
              <FormField required label="Amount" isCurrency scope={itemScope.scope("amountInCents")} />
            </div>
            <FormSelect
              divProps={{ className: "col-span-3 sm:col-span-4" }}
              required
              scope={itemScope.scope("methodId")}
              label="Method"
              placeholder="Select method"
              options={trxItemMethods.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
            <FormSelect
              divProps={{ className: "col-span-4" }}
              required
              scope={itemScope.scope("typeId")}
              label="Type"
              placeholder="Select type"
              options={trxItemTypes.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
          </div>
          <FormField
            scope={itemScope.scope("description")}
            label="Description"
            description="Will only be shown in transaction details and reports"
          />
        </fieldset>
      </CardContent>
      <CardFooter>
        <Button
          aria-label={`Remove ${title}`}
          onClick={removeItemHandler}
          variant="destructive"
          type="button"
          className="ml-auto"
        >
          Remove
        </Button>
      </CardFooter>
    </Card>
  );
}
