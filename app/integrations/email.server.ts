import type { SendEmailCommandInput, SendEmailCommandOutput } from "@aws-sdk/client-sesv2";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { nanoid } from "nanoid";

import { createLogger } from "~/integrations/logger.server";
import { Prettify } from "~/lib/utils";

const logger = createLogger("EmailService");
const client = new SESv2Client({ region: "us-east-1" });

export type SendEmailInput = {
  from: string;
  to: string | Array<string>;
  subject: string;
  html: string;
};
export async function sendEmail(props: SendEmailInput) {
  const input: SendEmailCommandInput = {
    FromEmailAddress: props.from,
    Destination: {
      ToAddresses: Array.isArray(props.to) ? props.to : [props.to],
    },
    Content: {
      Simple: {
        Subject: {
          Charset: "UTF-8",
          Data: props.subject,
        },
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: props.html,
          },
        },
        Headers: [
          {
            Name: "X-Entity-Ref-ID",
            Value: nanoid(),
          },
        ],
      },
    },
  };

  if (process.env.NODE_ENV === "production") {
    const command = new SendEmailCommand(input);
    const response = await client.send(command);
    if (!response.MessageId) {
      throw new Error("Email not sent");
    }

    return { messageId: response.MessageId, $metadata: response.$metadata } as Prettify<
      { messageId: string } & {
        $metadata: SendEmailCommandOutput["$metadata"];
      }
    >;
  }

  logger.debug(
    {
      From: props.from,
      To: props.to,
      Subject: props.subject,
    },
    "Email sent",
  );
  return { messageId: "test", $metadata: {} };
}
