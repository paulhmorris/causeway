import { ReimbursementRequestStatus } from "@prisma/client";
import { ValidatedForm } from "@rvf/react-router";
import { useNavigation } from "react-router";
import { z } from "zod/v4";

import { Callout } from "~/components/ui/callout";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { Textarea } from "~/components/ui/textarea";
import { loader } from "~/routes/_app.reimbursements.$reimbursementId";
import { cuid, currency, number, optionalLongText, select } from "~/schemas/fields";

type LoaderData = Awaited<ReturnType<typeof loader>>;
type Props = {
  rr: LoaderData["reimbursementRequest"];
  transactionCategories: LoaderData["transactionCategories"];
  accounts: LoaderData["accounts"];
  relatedTrx: LoaderData["relatedTrx"];
};

export const reimbursementRequestApprovalSchema = z
  .object({
    _action: z.enum(ReimbursementRequestStatus),
    id: cuid,
    amount: currency,
    categoryId: number,
    accountId: select,
    approverNote: optionalLongText.nullable(),
  })
  .refine((data) => data._action !== ReimbursementRequestStatus.APPROVED || data.accountId, {
    error: "Account is required for approvals",
    path: ["accountId"],
  });

export function ReimbursementRequestApprovalForm(props: Props) {
  const navigation = useNavigation();
  const currentAction = navigation.formData?.get("_action") as ReimbursementRequestStatus | undefined;

  const { rr, transactionCategories, accounts, relatedTrx } = props;
  return (
    <ValidatedForm
      noValidate
      method="post"
      schema={reimbursementRequestApprovalSchema}
      className="flex w-full"
      defaultValues={{
        id: rr.id,
        _action: ReimbursementRequestStatus.APPROVED,
        approverNote: rr.approverNote ?? "",
        amount: String(rr.amountInCents / 100.0),
        categoryId: relatedTrx?.transaction.category?.id ?? ("" as unknown as number),
        accountId: rr.account.id,
      }}
    >
      {(form) => (
        <>
          <input type="hidden" name="id" value={rr.id} />
          {rr.status === ReimbursementRequestStatus.PENDING ? (
            <fieldset>
              <legend>
                <Callout>
                  <span>Approving this will deduct from the below account for the amount specified.</span>
                </Callout>
              </legend>
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="description" className="mb-1.5">
                    Requester Notes
                  </Label>
                  <Textarea id="description" name="description" required readOnly defaultValue={rr.description ?? ""} />
                </div>
                <FormField scope={form.scope("amount")} type="number" label="Amount" isCurrency required />
                <FormSelect
                  required
                  scope={form.scope("categoryId")}
                  label="Transaction Category"
                  placeholder="Select category"
                  options={transactionCategories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />
                <FormSelect
                  scope={form.scope("accountId")}
                  label="Account to deduct from"
                  placeholder="Select account"
                  description="Required for approvals"
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: `${a.code} - ${a.description}`,
                  }))}
                />
                <FormTextarea
                  scope={form.scope("approverNote")}
                  label="Approver Notes"
                  description="Also appears as the transaction description"
                />
                <Separator />
                <div className="flex w-full flex-col gap-2 sm:flex-row-reverse sm:items-center">
                  <SubmitButton
                    name="_action"
                    value={ReimbursementRequestStatus.APPROVED}
                    isSubmitting={
                      form.formState.isSubmitting ? currentAction === ReimbursementRequestStatus.APPROVED : false
                    }
                    className="mb-24 sm:mb-0 md:ml-auto"
                  >
                    Approve
                  </SubmitButton>
                  <SubmitButton
                    name="_action"
                    value={ReimbursementRequestStatus.VOID}
                    isSubmitting={
                      form.formState.isSubmitting ? currentAction === ReimbursementRequestStatus.VOID : false
                    }
                    variant="outline"
                  >
                    Void
                  </SubmitButton>
                  <SubmitButton
                    name="_action"
                    value={ReimbursementRequestStatus.REJECTED}
                    isSubmitting={
                      form.formState.isSubmitting ? currentAction === ReimbursementRequestStatus.REJECTED : false
                    }
                    variant="destructive"
                  >
                    Reject
                  </SubmitButton>
                </div>
              </div>
            </fieldset>
          ) : (
            <>
              <input type="hidden" name="amount" value={rr.amountInCents} />
              <input type="hidden" name="categoryId" value={relatedTrx?.transaction.category?.id ?? ""} />
              <input type="hidden" name="accountId" value={rr.account.id} />
              <input type="hidden" name="approverNote" value={rr.approverNote ?? ""} />
              <SubmitButton
                name="_action"
                value={ReimbursementRequestStatus.PENDING}
                isSubmitting={
                  form.formState.isSubmitting ? currentAction === ReimbursementRequestStatus.PENDING : false
                }
                variant="outline"
                className="ml-auto"
              >
                Reopen
              </SubmitButton>
            </>
          )}
        </>
      )}
    </ValidatedForm>
  );
}
