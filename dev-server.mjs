import http from "node:http";
import { createRequire } from "node:module";
import { createServer as createViteServer } from "vite";

const require = createRequire(import.meta.url);
const { handler: geminiHandler } = require("./netlify/functions/gemini.js");

const port = Number(process.env.PORT || 8888);
process.env.NETLIFY_LOCAL = "true";

function loadDotEnv() {
  try {
    const fs = require("node:fs");
    const text = fs.readFileSync(".env", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env is optional for local UI checks.
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

loadDotEnv();

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});

const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith("/.netlify/functions/gemini")) {
    const body = await readBody(req);
    const result = await geminiHandler({
      httpMethod: req.method,
      headers: req.headers,
      body,
      path: "/.netlify/functions/gemini",
    });

    res.statusCode = result.statusCode || 200;
    for (const [key, value] of Object.entries(result.headers || {})) {
      res.setHeader(key, value);
    }
    res.end(result.body || "");
    return;
  }

  vite.middlewares(req, res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local server: http://127.0.0.1:${port}`);
});
