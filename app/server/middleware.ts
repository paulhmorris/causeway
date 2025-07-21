import { getGeo } from "hono-geo-middleware";
// eslint-disable-next-line import/order
import { createMiddleware } from "hono/factory";
import { isbot } from "isbot";

import { httpLogger } from "~/integrations/logger.server";

const matchers = ["/assets", "favicon", ".well-known", "site.webmanifest", "sitemap.xml", "robots.txt"];

export function loggerMiddleware() {
  return createMiddleware(async (c, next) => {
    if (matchers.some((m) => c.req.url.includes(m))) {
      return next();
    }

    const start = Date.now();
    await next();
    const end = Date.now();

    const geo = getGeo(c);
    const resStatus = c.res.status;
    const requestId = c.get("requestId") as string;
    const reqIsFromBot = c.req.header("cf-isbot") === "true" || isbot(c.req.header("user-agent") ?? "");

    const reqData: Record<string, unknown> = {
      id: requestId,
      uri: c.req.url,
      path: c.req.path,
      query: c.req.query(),
      method: c.req.method,
      is_bot: reqIsFromBot,
      user_agent: c.req.header("user-agent"),
      content_type: c.req.header("content-type"),
      duration: end - start,
      ip: geo.ip,
      geo: {
        city: geo.city,
        region: geo.region,
        country: geo.country,
        postalCode: geo.postalCode,
      },
    };

    const resData: Record<string, unknown> = {
      status: resStatus,
      request_id: requestId,
      request_uri: c.req.url,
      path: c.req.path,
      content_type: c.res.headers.get("content-type"),
      duration: end - start,
    };

    if (resStatus >= 300 && resStatus < 400) {
      resData.redirect_url = c.res.url;
      httpLogger.warn("Response", resData);
    }

    if (resStatus >= 400) {
      httpLogger.error("Response", resData);
    }

    httpLogger.info("Request", reqData);
    httpLogger.info("Response", resData);
  });
}
