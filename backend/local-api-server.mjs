import { createServer } from "node:http";
import { handler } from "./api-handler.mjs";

const host = process.env.LOCAL_API_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.LOCAL_API_PORT ?? "8787", 10);

if (!process.env.SESSION_COOKIE_SECURE) {
  process.env.SESSION_COOKIE_SECURE = "false";
}
if (!process.env.GOOGLE_CLIENT_ID) {
  process.env.GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID ?? "";
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("access-control-allow-origin", "http://127.0.0.1:5173");
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("access-control-allow-headers", "content-type,authorization");
    res.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
    res.end();
    return;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : null;

  const event = {
    rawPath: req.url.split("?")[0],
    body: bodyBuffer ? bodyBuffer.toString("utf-8") : "",
    headers: req.headers,
    requestContext: {
      http: {
        method: req.method
      }
    }
  };

  const result = await handler(event);
  res.statusCode = result.statusCode ?? 200;
  if (result.headers) {
    Object.entries(result.headers).forEach(([key, value]) => {
      if (typeof value === "string") {
        res.setHeader(key, value);
      }
    });
  }
  res.setHeader("access-control-allow-origin", "http://127.0.0.1:5173");
  res.setHeader("access-control-allow-credentials", "true");
  res.end(result.body ?? "");
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Local API listening on http://${host}:${port}`);
});
