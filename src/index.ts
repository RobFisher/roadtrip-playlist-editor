import http from "node:http";
import { buildGreeting } from "./app.js";

const appName = "Rob's Road-trip Playlist Editor";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(`${buildGreeting(appName)}\n`);
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
