import { Form } from "react-router";

import { Button } from "~/components/ui/button";

export function action() {
  // This is a test action to trigger Sentry error reporting
  throw new Error("This is a test error for Sentry");
}

export default function SentryTest() {
  return (
    <div>
      <h1>Sentry Test Page</h1>
      <p>This page is used to test Sentry error reporting.</p>
      <Form method="post">
        <Button type="submit">Trigger Server Error</Button>
      </Form>
      <Button
        onClick={() => {
          // This is a test client-side error to trigger Sentry reporting
          throw new Error("This is a test client-side error for Sentry");
        }}
      >
        Trigger Client Error
      </Button>
    </div>
  );
}
