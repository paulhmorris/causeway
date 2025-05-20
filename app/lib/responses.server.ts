/* eslint-disable @typescript-eslint/only-throw-error */
/* eslint-disable prefer-const */
import { Prisma } from "@prisma/client";
import { data, redirect } from "@remix-run/node";

/**
 * Create a response receiving a JSON object with the status code 201.
 * @example
 * export async function action({ request }: ActionArgs) {
 *   let result = await doSomething(request);
 *   return created(result);
 * }
 */
export function created<Data = unknown>(_data: Data, init?: Omit<ResponseInit, "status">) {
  return data(_data, { ...init, status: 201 });
}

/**
 * Create a new Response with a redirect set to the URL the user was before.
 * It uses the Referer header to detect the previous URL. It asks for a fallback
 * URL in case the Referer couldn't be found, this fallback should be a URL you
 * may be ok the user to land to after an action even if it's not the same.
 * @example
 * export async function action({ request }: ActionArgs) {
 *   await doSomething(request);
 *   // If the user was on `/search?query=something` we redirect to that URL
 *   // but if we couldn't we redirect to `/search`, which is an good enough
 *   // fallback
 *   return redirectBack(request, { fallback: "/search" });
 * }
 */
export function redirectBack(request: Request, { fallback, ...init }: ResponseInit & { fallback: string }): Response {
  return redirect(request.headers.get("Referer") ?? fallback, init);
}

/**
 * Create a response receiving a JSON object with the status code 400.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   let user = await getUser(request);
 *   throw badRequest<BoundaryData>({ user });
 * }
 */
export function badRequest<Data = unknown>(_data: Data, init?: Omit<ResponseInit, "status">) {
  return data<Data>(_data, { ...init, status: 400 });
}

/**
 * Create a response receiving a JSON object with the status code 401.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   let user = await getUser(request);
 *   throw unauthorized<BoundaryData>({ user });
 * }
 */
export function unauthorized<Data = unknown>(_data: Data, init?: Omit<ResponseInit, "status">) {
  return data<Data>(_data, { ...init, status: 401 });
}

/**
 * Create a response receiving a JSON object with the status code 403.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   let user = await getUser(request);
 *   if (!user.idAdmin) throw forbidden<BoundaryData>({ user });
 * }
 */
export function forbidden<Data = unknown>(_data: Data, init?: Omit<ResponseInit, "status">) {
  return data<Data>(_data, { ...init, status: 403 });
}

/**
 * Create a response receiving a JSON object with the status code 404.
 * @example
 * export async function loader({ request, params }: LoaderArgs) {
 *   let user = await getUser(request);
 *   if (!db.exists(params.id)) throw notFound<BoundaryData>({ user });
 * }
 */
export function notFound<Data = unknown>(_data: Data, init?: Omit<ResponseInit, "status">) {
  return data<Data>(_data, { ...init, status: 404 });
}

/**
 * Create a response receiving a JSON object with the status code 422.
 * @example
 * export async function loader({ request, params }: LoaderArgs) {
 *   let user = await getUser(request);
 *   throw unprocessableEntity<BoundaryData>({ user });
 * }
 */
export function unprocessableEntity<Data = unknown>(_data: Data, init?: Omit<ResponseInit, "status">) {
  return data<Data>(_data, { ...init, status: 422 });
}

/**
 * Create a response receiving a JSON object with the status code 409.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   let user = await getUser(request);
 *   throw conflict<BoundaryData>({ user });
 * }
 */
export function conflict<Data = unknown>(_data: Data, init?: Omit<ResponseInit, "status">) {
  return data<Data>(_data, { ...init, status: 409 });
}

/**
 * Create a response receiving a JSON object with the status code 500.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   let user = await getUser(request);
 *   throw serverError<BoundaryData>({ user });
 * }
 */
export function serverError<Data = unknown>(_data: Data, init?: Omit<ResponseInit, "status">) {
  return data<Data>(_data, { ...init, status: 500 });
}

/**
 * Create a response with only the status 304 and optional headers.
 * This is useful when trying to implement conditional responses based on Etags.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   return notModified();
 * }
 */
export function notModified(init?: Omit<ResponseInit, "status">) {
  return new Response("", { ...init, status: 304 });
}

/**
 * Create a response with a JavaScript file response.
 * It receives a string with the JavaScript content and set the Content-Type
 * header to `application/javascript; charset=utf-8` always.
 *
 * This is useful to dynamically create a JS file from a Resource Route.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   return javascript("console.log('Hello World')");
 * }
 */
export function javascript(content: string, init: number | ResponseInit = {}): Response {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/javascript; charset=utf-8");
  }

  return new Response(content, {
    ...responseInit,
    headers,
  });
}

/**
 * Create a response with a CSS file response.
 * It receives a string with the CSS content and set the Content-Type header to
 * `text/css; charset=utf-8` always.
 *
 * This is useful to dynamically create a CSS file from a Resource Route.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   return css("body { color: red; }");
 * }
 */
export function stylesheet(content: string, init: number | ResponseInit = {}): Response {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "text/css; charset=utf-8");
  }

  return new Response(content, {
    ...responseInit,
    headers,
  });
}

/**
 * Create a response with a PDF file response.
 * It receives a string with the PDF content and set the Content-Type header to
 * `application/pdf; charset=utf-8` always.
 *
 * This is useful to dynamically create a PDF file from a Resource Route.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   return pdf(await generatePDF(request.formData()));
 * }
 */
export function pdf(content: Blob | Buffer | ArrayBuffer, init: number | ResponseInit = {}): Response {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/pdf");
  }

  return new Response(content, {
    ...responseInit,
    headers,
  });
}

/**
 * Create a response with a HTML file response.
 * It receives a string with the HTML content and set the Content-Type header to
 * `text/html; charset=utf-8` always.
 *
 * This is useful to dynamically create a HTML file from a Resource Route.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   return html("<h1>Hello World</h1>");
 * }
 */
export function html(content: string, init: number | ResponseInit = {}): Response {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "text/html; charset=utf-8");
  }

  return new Response(content, {
    ...responseInit,
    headers,
  });
}

/**
 * Create a response with a XML file response.
 * It receives a string with the XML content and set the Content-Type header to
 * `application/xml; charset=utf-8` always.
 *
 * This is useful to dynamically create a XML file from a Resource Route.
 * @example
 * export let loader: LoaderFunction = async ({ request }) => {
 *   return xml("<?xml version='1.0'?><catalog></catalog>");
 * }
 */
export function xml(content: string, init: number | ResponseInit = {}): Response {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/xml; charset=utf-8");
  }

  return new Response(content, {
    ...responseInit,
    headers,
  });
}

/**
 * Create a response with a TXT file response.
 * It receives a string with the TXT content and set the Content-Type header to
 * `text/plain; charset=utf-8` always.
 *
 * This is useful to dynamically create a TXT file from a Resource Route.
 * @example
 * export let loader: LoaderFunction = async ({ request }) => {
 *   return txt(`
 *     User-agent: *
 *     Allow: /
 *   `);
 * }
 */
export function txt(content: string, init: number | ResponseInit = {}): Response {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "text/plain; charset=utf-8");
  }

  return new Response(content, {
    ...responseInit,
    headers,
  });
}

export type ImageType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/svg+xml"
  | "image/webp"
  | "image/bmp"
  | "image/avif";

/**
 * Create a response with a image file response.
 * It receives a Buffer, ArrayBuffer or ReadableStream with the image content
 * and set the Content-Type header to the `type` parameter.
 *
 * This is useful to dynamically create a image file from a Resource Route.
 * @example
 * export async function loader({ request }: LoaderArgs) {
 *   return image(await takeScreenshot(), { type: "image/avif" });
 * }
 */
export function image(
  content: Buffer | ArrayBuffer | ReadableStream,
  { type, ...init }: ResponseInit & { type: ImageType },
): Response {
  let headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", type);
  }

  return new Response(content, {
    ...init,
    headers,
  });
}

export function handlePrismaError(error: Prisma.PrismaClientKnownRequestError) {
  switch (error.code) {
    case "P1000":
      throw unauthorized("Access denied.");
    case "P1001":
    case "P1002":
      throw serverError("Server is unreachable or timed out.");
    case "P1003":
      throw notFound("Requested item does not exist.");
    case "P1008":
      throw serverError("Operation timed out.");
    case "P1009":
      throw conflict("Item already exists.");
    case "P1010":
      throw unauthorized("Access denied.");
    case "P1011":
      throw serverError("Connection error.");
    case "P1012":
      throw badRequest("Validation error.");
    case "P1013":
      throw badRequest("Invalid input.");
    case "P1014":
      throw notFound("Requested item does not exist.");
    case "P1015":
      throw badRequest("Unsupported features.");
    case "P1016":
      throw badRequest("Incorrect parameters.");
    case "P1017":
      throw serverError("Connection closed by server.");
    case "P2000":
      throw badRequest("Input is too long.");
    case "P2001":
      throw notFound("Requested item does not exist.");
    case "P2002":
      throw conflict("Conflict with existing item.");
    case "P2003":
      throw conflict("Conflict with existing item.");
    case "P2004":
      throw conflict("Conflict with existing item.");
    case "P2005":
      throw badRequest("Invalid input.");
    case "P2006":
      throw badRequest("Invalid input.");
    case "P2007":
      throw badRequest("Validation error.");
    case "P2008":
      throw badRequest("Query error.");
    case "P2009":
      throw badRequest("Query error.");
    case "P2010":
      throw serverError("Query error.");
    case "P2011":
      throw badRequest("Null constraint violation.");
    case "P2012":
      throw badRequest("Missing required value.");
    case "P2013":
      throw badRequest("Missing required argument.");
    case "P2014":
      throw conflict("Conflict with existing relation.");
    case "P2015":
      throw notFound("Related item not found.");
    case "P2016":
      throw badRequest("Query interpretation error.");
    case "P2017":
      throw notFound("Related items not connected.");
    case "P2018":
      throw notFound("Required connected items not found.");
    case "P2019":
      throw badRequest("Input error.");
    case "P2020":
      throw badRequest("Value out of range.");
    case "P2021":
      throw notFound("Table does not exist.");
    case "P2022":
      throw notFound("Column does not exist.");
    case "P2023":
      throw badRequest("Inconsistent data.");
    case "P2024":
      throw serverError("Connection timeout.");
    case "P2025":
      throw notFound("Required items not found.");
    case "P2026":
      throw badRequest("Unsupported feature.");
    case "P2027":
      throw serverError("Multiple errors occurred.");
    case "P2028":
      throw serverError("Transaction error.");
    case "P2030":
      throw badRequest("Fulltext index not found.");
    case "P2031":
      throw serverError("Transaction requirement error.");
    case "P2033":
      throw badRequest("Number out of range.");
    case "P2034":
      throw serverError("Transaction conflict.");
    default:
      throw serverError("An unknown error occurred.");
  }
}

export function getPrismaErrorText(error: Prisma.PrismaClientKnownRequestError) {
  switch (error.code) {
    case "P1000":
      return "Access denied.";
    case "P1001":
    case "P1002":
      return "Server is unreachable or timed out.";
    case "P1003":
      return "Requested item does not exist.";
    case "P1008":
      return "Operation timed out.";
    case "P1009":
      return "Item already exists.";
    case "P1010":
      return "Access denied.";
    case "P1011":
      return "Connection error.";
    case "P1012":
      return "Validation error.";
    case "P1013":
      return "Invalid input.";
    case "P1014":
      return "Requested item does not exist.";
    case "P1015":
      return "Unsupported features.";
    case "P1016":
      return "Incorrect parameters.";
    case "P1017":
      return "Connection closed by server.";
    case "P2000":
      return "Input is too long.";
    case "P2001":
      return "Requested item does not exist.";
    case "P2002":
      return "Conflict with existing item.";
    case "P2003":
      return "Conflict with existing item.";
    case "P2004":
      return "Conflict with existing item.";
    case "P2005":
      return "Invalid input.";
    case "P2006":
      return "Invalid input.";
    case "P2007":
      return "Validation error.";
    case "P2008":
      return "Query error.";
    case "P2009":
      return "Query error.";
    case "P2010":
      return "Query error.";
    case "P2011":
      return "Null constraint violation.";
    case "P2012":
      return "Missing required value.";
    case "P2013":
      return "Missing required argument.";
    case "P2014":
      return "Conflict with existing relation.";
    case "P2015":
      return "Related item not found.";
    case "P2016":
      return "Query interpretation error.";
    case "P2017":
      return "Related items not connected.";
    case "P2018":
      return "Required connected items not found.";
    case "P2019":
      return "Input error.";
    case "P2020":
      return "Value out of range.";
    case "P2021":
      return "Table does not exist.";
    case "P2022":
      return "Column does not exist.";
    case "P2023":
      return "Inconsistent data.";
    case "P2024":
      return "Connection timeout.";
    case "P2025":
      return "Required items not found.";
    case "P2026":
      return "Unsupported feature.";
    case "P2027":
      return "Multiple errors occurred.";
    case "P2028":
      return "Transaction error.";
    case "P2030":
      return "Fulltext index not found.";
    case "P2031":
      return "Transaction requirement error.";
    case "P2033":
      return "Number out of range.";
    case "P2034":
      return "Transaction conflict.";
    default:
      return "An unknown error occurred.";
  }
}
