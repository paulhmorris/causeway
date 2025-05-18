// https://github.com/forge42dev/remix-toast

/* eslint-disable @typescript-eslint/require-await */
import { data, redirect } from "@remix-run/node";
import {
  createCookieFactory,
  createCookieSessionStorageFactory,
  SessionIdStorageStrategy,
  SessionStorage,
} from "@remix-run/server-runtime";
import { nanoid } from "nanoid";
import { z } from "zod";
import { fromError, fromZodError, isValidationErrorLike, isZodErrorLike } from "zod-validation-error";

const toastMessageSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  duration: z.number().int().positive().optional(),
  type: z.custom<"info" | "success" | "error" | "warning">(),
});

const flashSessionValuesSchema = z.object({
  toast: toastMessageSchema.optional(),
});

type ToastMessage = z.infer<typeof toastMessageSchema>;

type FlashSessionValues = z.infer<typeof flashSessionValuesSchema>;

const FLASH_SESSION = "flash";
const createCookie = createCookieFactory({ sign, unsign });
type ToastCookieOptions = Partial<SessionIdStorageStrategy["cookie"]>;

const secret = nanoid();
const toastCookieOptions = {
  name: "toast-session",
  sameSite: "lax",
  path: "/",
  httpOnly: true,
  secrets: [secret],
} satisfies ToastCookieOptions;

const sessionStorage = createCookieSessionStorageFactory(createCookie)({
  cookie: toastCookieOptions,
});

/**
 * Sets the cookie options to be used for the toast cookie
 *
 * @param options Cookie options to be used for the toast cookie
 */
export function setToastCookieOptions(options: ToastCookieOptions) {
  Object.assign(toastCookieOptions, options);
  Object.assign(
    sessionStorage,
    createCookieSessionStorageFactory(createCookie)({
      cookie: toastCookieOptions,
    }),
  );
}

async function flashMessage(
  flash: FlashSessionValues,
  headers?: ResponseInit["headers"],
  customSession?: SessionStorage,
) {
  const sessionToUse = customSession ? customSession : sessionStorage;
  const session = await sessionToUse.getSession();
  session.flash(FLASH_SESSION, flash);
  const cookie = await sessionToUse.commitSession(session);
  const newHeaders = new Headers(headers);
  newHeaders.append("Set-Cookie", cookie);
  return newHeaders;
}

async function redirectWithFlash(
  url: string,
  flash: FlashSessionValues,
  init?: ResponseInit,
  customSession?: SessionStorage,
) {
  return redirect(url, {
    ...init,
    headers: await flashMessage(flash, init?.headers, customSession),
  });
}

async function jsonWithFlash<T>(
  _data: T,
  flash: FlashSessionValues,
  init?: ResponseInit,
  customSession?: SessionStorage,
) {
  return data(_data, {
    ...init,
    headers: await flashMessage(flash, init?.headers, customSession),
  });
}

type BaseFactoryType = {
  session?: SessionStorage;
  type: "info" | "success" | "error" | "warning";
};

const jsonWithToastFactory = ({ type, session }: BaseFactoryType) => {
  return <T>(
    data: T,
    titleOrToast: string | Omit<ToastMessage, "type">,
    init?: ResponseInit,
    customSession?: SessionStorage,
  ) => {
    const finalInfo = typeof titleOrToast === "string" ? { title: titleOrToast } : titleOrToast;
    return jsonWithFlash(data, { toast: { ...finalInfo, type } }, init, customSession ?? session);
  };
};

const redirectWithToastFactory = ({ type, session }: BaseFactoryType) => {
  return (
    redirectUrl: string,
    titleOrToast: string | Omit<ToastMessage, "type">,
    init?: ResponseInit,
    customSession?: SessionStorage,
  ) => {
    const finalInfo = typeof titleOrToast === "string" ? { title: titleOrToast } : titleOrToast;
    return redirectWithFlash(redirectUrl, { toast: { ...finalInfo, type } }, init, customSession ?? session);
  };
};

/**
 * Helper method used to get the toast data from the current request and purge the flash storage from the session
 * @param request Current request
 * @returns Returns the the toast notification if exists, undefined otherwise and the headers needed to purge it from the session
 */
export async function getToast(
  request: Request,
  customSession?: SessionStorage,
): Promise<{ toast: ToastMessage | undefined; headers: Headers }> {
  const sessionToUse = customSession ? customSession : sessionStorage;
  const cookie = request.headers.get("Cookie");
  const session = await sessionToUse.getSession(cookie);
  const result = flashSessionValuesSchema.safeParse(session.get(FLASH_SESSION));
  const flash = result.success ? result.data : undefined;
  const headers = new Headers({
    "Set-Cookie": await sessionToUse.commitSession(session),
  });
  const toast = flash?.toast;
  return { toast, headers };
}

export type { ToastCookieOptions, ToastMessage };

/**
 * Helper method used to initialize the whole library using a custom session. Returns all the utilities enhanced with the custom session
 * you provide.
 *
 * These utilities will not override the default session, but will use the custom one you provide. So be careful of imports if you plan to
 * use both, or only plan to use this one.
 * @param session Custom session to be used instead of the default one
 * @returns Returns all the utilities you need to display toast notifications and redirect the user or return jsons with toast notifications
 */
export const createToastUtilsWithCustomSession = (session: SessionStorage) => {
  return {
    jsonWithToast: <T>(data: T, toast: ToastMessage, init?: ResponseInit) => {
      return jsonWithFlash(data, { toast }, init, session);
    },
    jsonWithSuccess: jsonWithToastFactory({ type: "success", session }),
    jsonWithError: jsonWithToastFactory({ type: "error", session }),
    jsonWithInfo: jsonWithToastFactory({ type: "info", session }),
    jsonWithWarning: jsonWithToastFactory({ type: "warning", session }),
    redirectWithToast: (redirectUrl: string, toast: ToastMessage, init?: ResponseInit) => {
      return redirectWithFlash(redirectUrl, { toast }, init, session);
    },
    redirectWithSuccess: redirectWithToastFactory({ type: "success", session }),
    redirectWithError: redirectWithToastFactory({ type: "error", session }),
    redirectWithInfo: redirectWithToastFactory({ type: "info", session }),
    redirectWithWarning: redirectWithToastFactory({ type: "warning", session }),
    getToast: (request: Request) => getToast(request, session),
  };
};

/**
 * Helper method used to display a toast notification without redirection
 *
 * @param data Generic object containing the data
 * @param toast Toast message and it's type
 * @param init Additional response options (status code, additional headers etc)
 * @returns Returns data with toast cookie set
 */
const jsonWithToast = <T>(data: T, toast: ToastMessage, init?: ResponseInit, customSession?: SessionStorage) => {
  return jsonWithFlash(data, { toast }, init, customSession);
};

/**
 * Helper method used to generate a JSON response object with a success toast message.
 *
 * @param data The data to be included in the response.
 * @param message The message for the success toast notification.
 * @param init Additional response options (status code, additional headers etc)
 * @returns Returns a JSON response object with the specified success toast message.
 */
const jsonWithSuccess = jsonWithToastFactory({ type: "success" });

/**
 * Helper method used to generate a JSON response object with an error toast message.
 *
 * @param data The data to be included in the response.
 * @param message The message for the error toast notification.
 * @param init Additional response options (status code, additional headers etc)
 * @returns Returns a JSON response object with the specified error toast message.
 */
const jsonWithError = jsonWithToastFactory({ type: "error" });
/**
 * Helper method used to generate a JSON response object with an info toast message.
 *
 * @param data The data to be included in the response.
 * @param message The message for the info toast notification.
 * @param init Additional response options (status code, additional headers etc)
 * @returns Returns a JSON response object with the specified info toast message.
 */
const jsonWithInfo = jsonWithToastFactory({ type: "info" });

/**
 * Helper method used to generate a JSON response object with a warning toast message.
 *
 * @param data The data to be included in the response.
 * @param message The message for the warning toast notification.
 * @param init Additional response options (status code, additional headers etc)
 * @returns Returns a JSON response object with the specified warning toast message.
 */
const jsonWithWarning = jsonWithToastFactory({ type: "warning" });

/**
 * Helper method used to redirect the user to a new page with a toast notification
 *
 * If thrown it needs to be awaited
 * @param url Redirect URL
 * @param toast Toast message and it's type
 * @param init Additional response options (status code, additional headers etc)
 * @returns Returns redirect response with toast cookie set
 */
const redirectWithToast = (
  redirectUrl: string,
  toast: ToastMessage,
  init?: ResponseInit,
  customSession?: SessionStorage,
) => {
  return redirectWithFlash(redirectUrl, { toast }, init, customSession);
};

/**
 * Helper method used to redirect the user to a new page with an error toast notification
 *
 * If this method is thrown it needs to be awaited, otherwise it can just be returned
 * @param redirectUrl Redirect url
 * @param message Message to be shown as info
 * @param init Additional response options (status code, additional headers etc)
 * @returns Returns redirect response with toast cookie set
 */
const redirectWithError = redirectWithToastFactory({ type: "error" });

/**
 * Helper method used to redirect the user to a new page with a success toast notification
 *
 * If this method is thrown it needs to be awaited, otherwise it can just be returned
 * @param redirectUrl Redirect url
 * @param message Message to be shown as info
 * @param init Additional response options (status code, additional headers etc)
 * @returns Returns redirect response with toast cookie set
 */
const redirectWithSuccess = redirectWithToastFactory({ type: "success" });

/**
 * Helper method used to redirect the user to a new page with a warning toast notification
 *
 * If this method is thrown it needs to be awaited, otherwise it can just be returned
 * @param redirectUrl Redirect url
 * @param message Message to be shown as info
 * @param init Additional response options (status code, additional headers etc)
 * @returns Returns redirect response with toast cookie set
 */
const redirectWithWarning = redirectWithToastFactory({ type: "warning" });

/**
 * Helper method used to redirect the user to a new page with a info toast notification
 *
 * If this method is thrown it needs to be awaited, otherwise it can just be returned
 * @param redirectUrl Redirect url
 * @param message Message to be shown as info
 * @param init Additional response options (status code, additional headers etc)
 * @returns Returns redirect response with toast cookie set
 */
const redirectWithInfo = redirectWithToastFactory({ type: "info" });

// Prebuilt toasts
function formError<T>(error: unknown, data?: T) {
  if (typeof error === "string") {
    return jsonWithError(data, "Invalid form data");
  }

  if (isZodErrorLike(error)) {
    const _error = fromZodError(error).toString();
    return jsonWithError(data, { title: "Invalid form data", description: _error });
  }

  if (isValidationErrorLike(error)) {
    const msg = fromError(error).toString();
    return jsonWithError(data, { title: "Invalid form data", description: msg });
  }

  return jsonWithError(data, { title: "Invalid form data", description: JSON.stringify(error) });
}

export const Toasts = {
  getToast,
  jsonWithInfo,
  jsonWithError,
  jsonWithToast,
  jsonWithSuccess,
  jsonWithWarning,
  redirectWithInfo,
  redirectWithError,
  redirectWithToast,
  redirectWithSuccess,
  redirectWithWarning,

  formError,
};

async function sign(value: string) {
  return value + ".";
}

async function unsign(signed: string) {
  const index = signed.lastIndexOf(".");
  const value = signed.slice(0, index);

  return value;
}
