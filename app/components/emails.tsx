import { ReimbursementRequestStatus } from "@prisma/client";
import { render } from "@react-email/render";

import { ReimbursementRequestUpdateEmail } from "emails/reimbursement-request-update";

export function getReimbursementRequestUpdateEmailHtml({
  url,
  status,
}: {
  url: string;
  status: ReimbursementRequestStatus;
}) {
  return render(<ReimbursementRequestUpdateEmail status={status} url={url} />);
}
