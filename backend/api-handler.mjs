function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

export async function handler(event) {
  const method = event?.requestContext?.http?.method ?? "GET";
  const path = event?.rawPath ?? "/";

  if (method === "GET" && path === "/api/health") {
    return json(200, {
      ok: true,
      env: process.env.ENV_NAME ?? "unknown",
      timestamp: new Date().toISOString()
    });
  }

  if (method === "GET" && path === "/api/me") {
    return json(200, {
      authenticated: false,
      user: null,
      message: "Session auth is not implemented yet."
    });
  }

  return json(404, {
    message: `No route for ${method} ${path}`
  });
}
