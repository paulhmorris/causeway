import {} from "@clerk/react-router/";
import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { IconChevronRight } from "@tabler/icons-react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { z } from "zod/v4";

import { AuthCard } from "~/components/auth/auth-card";
import { ErrorComponent } from "~/components/error-component";
import { BigButton } from "~/components/ui/big-button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { normalizeEnum } from "~/lib/utils";
import { checkbox, optionalText, text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.ChooseOrg");

const schema = z.object({
  orgId: text,
  redirectTo: optionalText,
  rememberSelection: checkbox,
});

export const loader = async (args: LoaderFunctionArgs) => {
  const userId = await SessionService.requireUserId(args);
  const session = await SessionService.getSession(args);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      memberships: {
        select: {
          org: {
            select: { id: true, name: true },
          },
          role: true,
          isDefault: true,
        },
      },
    },
  });

  if (!user) {
    throw await SessionService.logout(session.sessionId);
  }

  if (user.memberships.length === 0) {
    logger.warn(`User ${userId} has no memberships, logging them out.`);
    await SessionService.logout(session.sessionId);
    return Toasts.redirectWithError("/login", {
      message: "Error",
      description: "You are not a member of any organizations.",
    });
  }

  if (user.memberships.length === 1) {
    logger.info(`User ${userId} has only one membership, redirecting to that organization.`);
    const orgId = user.memberships[0].org.id;
    return SessionService.createOrgSession({ fnArgs: args, redirectTo: "/", orgId });
  }

  const defaultMembership = user.memberships.find((m) => m.isDefault);
  if (defaultMembership) {
    logger.info(`User ${userId} has a default membership, redirecting to that organization.`);
    const orgId = defaultMembership.org.id;
    return SessionService.createOrgSession({ fnArgs: args, redirectTo: "/", orgId });
  }

  const orgs = user.memberships.map((m) => ({
    id: m.org.id,
    name: m.org.name,
    role: normalizeEnum(m.role),
    isDefault: m.isDefault,
  }));
  return { orgs };
};

export const action = async (args: ActionFunctionArgs) => {
  const userId = await SessionService.requireUserId(args);
  const result = await parseFormData(args.request, schema);

  if (result.error) {
    return validationError(result.error);
  }

  const { orgId, redirectTo, rememberSelection } = result.data;

  try {
    // Ensure the user is a member of the selected organization
    await db.membership.findUniqueOrThrow({ where: { userId_orgId: { userId, orgId } }, select: { id: true } });

    // Skip this screen on future logins
    if (rememberSelection) {
      await db.membership.update({
        data: { isDefault: true },
        where: {
          userId_orgId: { orgId, userId },
        },
      });
    } else {
      await db.membership.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const url = new URL(args.request.url);
    const redirectUrl = new URL(redirectTo ?? "/", url.origin);

    return SessionService.createOrgSession({ fnArgs: args, redirectTo: redirectUrl.toString(), orgId });
  } catch (error) {
    Sentry.captureException(error, { tags: { userId, orgId } });
    logger.error(`Error selecting organization for user ${userId}:`, error);
    return Toasts.dataWithError(null, {
      message: "Error",
      description: "You are not a member of this organization.",
    });
  }
};

export const meta: MetaFunction = () => [{ title: "Choose Organization" }];

export default function ChooseOrgPage() {
  const { orgs } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  return (
    <AuthCard>
      <h1 className="text-4xl font-extrabold">Choose organization</h1>
      <p className="text-muted-foreground mt-1 text-sm">You can change organizations at any time.</p>
      <ValidatedForm
        schema={schema}
        method="post"
        className="mt-6 space-y-4"
        defaultValues={{
          redirectTo: redirectTo === "/" ? undefined : redirectTo,
          rememberSelection: "",
          orgId: "",
        }}
      >
        <input type="hidden" name="redirectTo" value={redirectTo === "/choose-org" ? "/" : redirectTo} />
        <Label className="inline-flex cursor-pointer items-center gap-2">
          <Checkbox
            name="rememberSelection"
            defaultChecked={orgs.some((o) => o.isDefault)}
            aria-label="Remember selection"
          />
          <span>Remember selection</span>
        </Label>
        <div className="flex max-h-[30dvh] flex-col gap-y-4 overflow-y-scroll">
          {orgs.map((org) => {
            return (
              <BigButton key={org.id} type="submit" name="orgId" value={org.id}>
                <div>
                  <p className="text-foreground text-lg font-bold">{org.name}</p>
                  <p className="text-muted-foreground text-sm">{normalizeEnum(org.role)}</p>
                </div>
                <IconChevronRight />
              </BigButton>
            );
          })}
        </div>
      </ValidatedForm>
    </AuthCard>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
