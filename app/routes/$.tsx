import { notFound } from "~/lib/responses.server";

/**
 * Splat route to fix 404 FOUC/hydration error
 *
 * @link {@see https://github.com/remix-run/remix/discussions/5186#discussioncomment-4748778}
 */
export function loader() {
  throw notFound(null);
}

export default function NotFound() {
  return null;
}
