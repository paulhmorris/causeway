import { Prisma } from "@prisma/client";
import { data, redirect } from "react-router";

import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { CONFIG } from "~/lib/env.server";

const logger = createLogger("Responses");

function responseFactory(status: number) {
  return <T = unknown>(body?: T, init?: Omit<ResponseInit, "status">) => {
    return data(body ?? null, { ...init, status });
  };
}

export const Responses = {
  ok: responseFactory(200),
  created: responseFactory(201),
  notModified: responseFactory(304),
  badRequest: responseFactory(400),
  unauthorized: responseFactory(401),
  forbidden: responseFactory(403),
  notFound: responseFactory(404),
  methodNotAllowed: responseFactory(405),
  conflict: responseFactory(409),
  unprocessableEntity: responseFactory(422),
  serverError: responseFactory(500),

  redirectBack(request: Request, { fallback, ...init }: ResponseInit & { fallback: string }): Response {
    return redirect(request.headers.get("Referer") ?? fallback, init);
  },

  redirectToSignIn(redirect_url?: string): never {
    const url = CONFIG.signInUrl;
    if (redirect_url) {
      url.searchParams.set("redirect_url", redirect_url);
    }
    throw redirect(url.toString());
  },

  redirectToSignUp(redirect_url?: string): never {
    const url = CONFIG.signUpUrl;
    if (redirect_url) {
      url.searchParams.set("redirect_url", redirect_url);
    }
    throw redirect(url.toString());
  },
};

export function handleLoaderError(e: unknown, request?: Request): never {
  if (e instanceof Error && request) {
    logger.error(`Loader error at path ${new URL(request.url).pathname}: ${e.message}`);
  } else {
    logger.error("Loader error", { error: e });
  }
  Sentry.captureException(e);

  // Handle Prisma Errors
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case "P2001": // No record found for where condition
      case "P2015": // Related record not found
      case "P2025": // No record found
        throw Responses.notFound();

      default: {
        throw Responses.serverError();
      }
    }
  }

  // Unknown error
  throw Responses.serverError();
}
