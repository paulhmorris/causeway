import { isRouteErrorResponse, useRouteError } from "react-router";

import { Sentry } from "~/integrations/sentry";

export function ErrorComponent({ error }: { error?: unknown }) {
  let _error = useRouteError();
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  _error ??= error;

  if (isRouteErrorResponse(_error)) {
    message = _error.status === 404 ? "404" : "Error";
    details = _error.status === 404 ? "The requested page could not be found." : _error.statusText || details;
  } else if (_error && _error instanceof Error) {
    Sentry.captureException(_error);
    if (import.meta.env.DEV) {
      details = _error.message;
      stack = _error.stack;
    }
  }

  return (
    <div className="mt-20">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{message}</h1>
      <p className="mt-2 text-base leading-7 text-muted-foreground">{details}</p>
      {stack ? (
        <>
          <p className="mt-24 text-left text-sm font-bold">Stack Trace</p>
          <pre className="whitespace-pre-wrap rounded bg-destructive/10 p-4 text-left text-xs text-destructive">
            <code>{stack}</code>
          </pre>
        </>
      ) : null}
    </div>
  );
}
