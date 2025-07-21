// eslint-disable-next-line import/order
import { GeoMiddleware } from "hono-geo-middleware";
import { requestId } from "hono/request-id";
import { handle } from "hono/vercel";
import { createHonoServer } from "react-router-hono-server/node";

import { loggerMiddleware } from "~/server/middleware";

const isVercel = process.env.VERCEL === "1";

const server = await createHonoServer({
  configure(server) {
    server.use(requestId());
    server.use(GeoMiddleware());
    server.use(loggerMiddleware());
  },
});

export default isVercel ? handle(server) : server;
