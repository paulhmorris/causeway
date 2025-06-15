import { Prisma } from "@prisma/client";
import { IconAddressBook, IconMail, IconPhone } from "@tabler/icons-react";
import { Link } from "react-router";

import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { useUser } from "~/hooks/useUser";
import { ContactType } from "~/lib/constants";
import { formatPhoneNumber, getInitials } from "~/lib/utils";

type Contact = Prisma.ContactGetPayload<{ include: { address: true; type: true } }>;
export function ContactCard({ contact }: { contact: Contact }) {
  const user = useUser();

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <span>
              {(contact.typeId as ContactType) === ContactType.Organization
                ? contact.organizationName
                : `${contact.firstName} ${contact.lastName ?? ""}`}
            </span>
            {user.contact.id === contact.id ? <Badge variant="outline">This is you</Badge> : null}
          </CardTitle>
          <CardDescription>
            <span>{contact.type.name}</span>
          </CardDescription>
        </div>
        <Avatar className="ml-auto">
          <AvatarFallback>{getInitials(contact)}</AvatarFallback>
        </Avatar>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          {contact.address ? (
            <div className="flex items-center gap-4">
              <>
                <dt className="self-start">
                  <span className="sr-only">Address</span>
                  <IconAddressBook className="text-muted-foreground size-5" />
                </dt>
                <dd>
                  <span className="block">
                    {contact.address.street}
                    {contact.address.street2}
                  </span>
                  <span className="block">
                    {contact.address.city}, {contact.address.state} {contact.address.zip}
                  </span>
                </dd>
              </>
            </div>
          ) : null}
          {contact.phone ? (
            <div className="flex items-center gap-4">
              <dt>
                <span className="sr-only">Phone</span>
                <IconPhone className="text-muted-foreground size-5" />
              </dt>
              <dd>
                <a href={`tel:${contact.phone}`}>{formatPhoneNumber(contact.phone)}</a>
              </dd>
            </div>
          ) : null}
          {contact.alternatePhone ? (
            <div className="flex items-center gap-4">
              <dt>
                <span className="sr-only">Phone</span>
                <IconPhone className="text-muted-foreground size-5" />
              </dt>
              <dd>
                <a href={`tel:${contact.alternatePhone}`}>{formatPhoneNumber(contact.alternatePhone)}</a>
              </dd>
            </div>
          ) : null}
          {contact.email ? (
            <div className="flex items-center gap-4">
              <dt>
                <span className="sr-only">Email</span>
                <IconMail className="text-muted-foreground size-5" />
              </dt>
              <dd>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </dd>
            </div>
          ) : null}
          {contact.alternateEmail ? (
            <div className="flex items-center gap-4">
              <dt>
                <span className="sr-only">Email</span>
                <IconMail className="text-muted-foreground size-5" />
              </dt>
              <dd>
                <a href={`mailto:${contact.alternateEmail}`}>{contact.alternateEmail}</a>
              </dd>
            </div>
          ) : null}
        </dl>
      </CardContent>
      {!user.isMember || user.contactAssignments.some((a) => a.contactId === contact.id) ? (
        <CardFooter>
          <Button variant="outline" className="ml-auto" asChild>
            <Link prefetch="intent" to={`/contacts/${contact.id}/edit`}>
              Edit
            </Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
