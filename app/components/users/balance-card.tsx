import { Link } from "react-router";
import { IconBuildingBank } from "@tabler/icons-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCentsAsDollars } from "~/lib/utils";

export function AccountBalanceCard({
  totalCents,
  accountId,
  code,
  title = "Account Balance",
}: {
  totalCents: number | null;
  accountId: string;
  code?: string;
  title?: string;
}) {
  return (
    <Card className="h-full">
      <Link to={`/accounts/${accountId}`}>
        <CardHeader>
          <CardTitle className="flex items-start gap-2">
            <div>
              <IconBuildingBank className="h-6 w-6" />
            </div>
            <span>{title}</span>
          </CardTitle>
          {code ? <CardDescription>{code}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <p className="sentry-mask text-4xl font-bold">{formatCentsAsDollars(totalCents)}</p>
        </CardContent>
      </Link>
    </Card>
  );
}
