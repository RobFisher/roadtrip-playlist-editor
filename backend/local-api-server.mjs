import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { handler } from "./api-handler.mjs";

function loadDotEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }
  const content = readFileSync(path, "utf-8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) {
      return;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) {
      return;
    }
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

loadDotEnvFile(".env.local");
loadDotEnvFile(".env");

const host = process.env.LOCAL_API_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.LOCAL_API_PORT ?? "8787", 10);

if (!process.env.SESSION_COOKIE_SECURE) {
  process.env.SESSION_COOKIE_SECURE = "false";
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
