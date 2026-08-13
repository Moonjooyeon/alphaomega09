const fs = require("node:fs");
const https = require("node:https");
const { URL } = require("node:url");
const config = require("../config");

function tossErrorDetail(body, fallback) {
  const error = body?.error;
  if (error && typeof error === "object") {
    return error.reason || error.message || error.errorCode || fallback;
  }
  return body?.message || body?.error || fallback;
}

function tossSuccess(body, fallback) {
  if (body?.resultType === "SUCCESS" && body.success && typeof body.success === "object") {
    return body.success;
  }
  const error = new Error(tossErrorDetail(body, fallback));
  error.status = 502;
  error.upstream = body;
  throw error;
}

function mtlsOptions() {
  if (!config.toss.mtlsCertPath || !config.toss.mtlsKeyPath) {
    const error = new Error("Toss mTLS 인증서 경로가 설정되지 않았습니다.");
    error.status = 503;
    throw error;
  }
  return {
    cert: fs.readFileSync(config.toss.mtlsCertPath),
    key: fs.readFileSync(config.toss.mtlsKeyPath),
    passphrase: config.toss.mtlsKeyPassword || undefined,
  };
}

function tossHttpJson(path, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const url = new URL(`${config.toss.apiBase}${path}`);
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = https.request(
      {
        ...mtlsOptions(),
        method,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        timeout: 60000,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": String(payload.length) } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed = {};
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            parsed = { error: text || `HTTP ${res.statusCode}` };
          }
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      }
    );
    req.on("error", (error) => resolve({ status: 599, body: { error: error.message } }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 598, body: { error: "Toss API request timed out" } });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function loginWithToss({ authorizationCode, referrer }) {
  const tokenResponse = await tossHttpJson("/api-partner/v1/apps-in-toss/user/oauth2/generate-token", {
    method: "POST",
    body: { authorizationCode, referrer },
  });
  if (tokenResponse.status >= 400) {
    const error = new Error(tossErrorDetail(tokenResponse.body, "Toss 로그인 토큰 요청에 실패했습니다."));
    error.status = 502;
    throw error;
  }

  const token = tossSuccess(tokenResponse.body, "Toss 로그인 토큰 요청에 실패했습니다.");
  if (!token.accessToken) {
    const error = new Error("Toss 로그인 토큰 응답에 accessToken이 없습니다.");
    error.status = 502;
    throw error;
  }

  const meResponse = await tossHttpJson("/api-partner/v1/apps-in-toss/user/oauth2/login-me", {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (meResponse.status >= 400) {
    const error = new Error(tossErrorDetail(meResponse.body, "Toss 사용자 정보 요청에 실패했습니다."));
    error.status = 502;
    throw error;
  }

  const tossUser = tossSuccess(meResponse.body, "Toss 사용자 정보 요청에 실패했습니다.");
  const userKey = String(tossUser.userKey || "").trim();
  if (!userKey) {
    const error = new Error("Toss 사용자 정보 응답에 userKey가 없습니다.");
    error.status = 502;
    throw error;
  }

  return { userKey, raw: tossUser };
}

module.exports = { loginWithToss };
