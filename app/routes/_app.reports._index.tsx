/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Link, MetaFunction } from "react-router";
import { IconCloudDownload } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useState } from "react";
import { useIsClient } from "usehooks-ts";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export const meta: MetaFunction = () => {
  return [{ title: "Reports" }];
};

export default function AdminReports() {
  const isClient = useIsClient();
  const [trxStartDate, setTrxStartDate] = useState(dayjs().subtract(3, "month").format("YYYY-MM-DD"));
  const [trxEndDate, setTrxEndDate] = useState(dayjs().format("YYYY-MM-DD"));

  // Trx report
  const trxUrl = isClient ? new URL("/api/reports/transactions", window?.location.origin) : undefined;
  if (trxUrl) {
    trxUrl.searchParams.append("trxStartDate", trxStartDate);
    trxUrl.searchParams.append("trxEndDate", trxEndDate);
    trxUrl.searchParams.append("tzOffset", dayjs().utcOffset().toString());
  }

  // Contacts report
  const contactsUrl = isClient ? new URL("/api/reports/contacts", window?.location.origin) : undefined;

  return (
    <>
      <PageHeader title="Reports" />
      <p className="mt-2 text-sm text-muted-foreground">Generate reports for your organization.</p>
      <PageContainer>
        <h2 className="mb-2 font-bold">Transactions Report</h2>
        <div className="max-w-xs space-y-2">
          <div className="space-y-1">
            <Label htmlFor="trxStartDate">Start Date</Label>
            <span className="ml-1 text-destructive">*</span>
            <Input
              id="trxStartDate"
              value={trxStartDate}
              onChange={(e) => setTrxStartDate(e.target.value)}
              name="trxStartDate"
              type="date"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="trxEndDate">End Date</Label>
            <span className="ml-1 text-destructive">*</span>
            <Input
              id="trxEndDate"
              value={trxEndDate}
              onChange={(e) => setTrxEndDate(e.target.value)}
              name="trxEndDate"
              type="date"
            />
          </div>
          {isClient ? (
            <Button variant="outline" asChild>
              <Link reloadDocument to={trxUrl ? trxUrl.toString() : ""} className="flex items-center gap-2">
                <IconCloudDownload className="size-4" />
                <span>Download</span>
              </Link>
            </Button>
          ) : null}
        </div>
        <h2 className="mb-2 mt-8 font-bold">Contacts Report</h2>
        <div className="max-w-xs space-y-2">
          {isClient ? (
            <Button variant="outline" asChild>
              <Link reloadDocument to={contactsUrl ? contactsUrl.toString() : ""} className="flex items-center gap-2">
                <IconCloudDownload className="size-4" />
                <span>Download</span>
              </Link>
            </Button>
          ) : null}
        </div>
      </PageContainer>
    </>
  );
}
