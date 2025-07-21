import type { SendEmailCommandInput, SendEmailCommandOutput } from "@aws-sdk/client-sesv2";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { nanoid } from "nanoid";

import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { CONFIG } from "~/lib/env.server";
import { Prettify } from "~/lib/utils";

const logger = createLogger("EmailService");
const client = new SESv2Client({ region: "us-east-1" });

type SendInput = {
  to: string | Array<string>;
  subject: string;
  html: string;
  from?: string;
  bcc?: string | Array<string>;
  cc?: string | Array<string>;
};

export const Mailer = {
  client,
  async send(props: SendInput) {
    const input = {
      FromEmailAddress: props.from ?? CONFIG.defaultEmailFromAddress,
      Destination: {
        ToAddresses: Array.isArray(props.to) ? props.to : [props.to],
        BccAddresses: props.bcc ? (Array.isArray(props.bcc) ? props.bcc : [props.bcc]) : undefined,
        CcAddresses: props.cc ? (Array.isArray(props.cc) ? props.cc : [props.cc]) : undefined,
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
    } satisfies SendEmailCommandInput;

    if (CONFIG.isProd || CONFIG.isPreview) {
      logger.info("Sending email", { props });
      try {
        const command = new SendEmailCommand(input);
        const response = await client.send(command);
        if (!response.MessageId) {
          throw new Error("Email not sent");
        }

        logger.info("Email sent successfully", { messageId: response.MessageId });
        return { messageId: response.MessageId, $metadata: response.$metadata } as Prettify<
          { messageId: string } & {
            $metadata: SendEmailCommandOutput["$metadata"];
          }
        >;
      } catch (e) {
        logger.error("Error sending email", { error: e });
        Sentry.captureException(e);
        throw e;
      }
    }

    logger.debug("Email sent", { props });
    return { messageId: "test", $metadata: {} };
  },
};
