const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const config = require("../config");

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function decodeJwsPayload(jws) {
  const [, payload] = String(jws || "").split(".");
  if (!payload) throw new Error("Apple transaction JWS를 읽지 못했습니다.");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

async function applePrivateKey() {
  const key = config.appStore.privateKey;
  if (key) return key.replace(/\\n/g, "\n");
  if (config.appStore.privateKeyPath) return fs.readFile(config.appStore.privateKeyPath, "utf8");
  return "";
}

async function appStoreJwt() {
  const { bundleId, issuerId, keyId } = config.appStore;
  const privateKey = await applePrivateKey();
  if (!bundleId || !issuerId || !keyId || !privateKey) {
    const error = new Error("Apple 결제 검증 환경변수가 부족합니다.");
    error.status = 500;
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 15 * 60,
      aud: "appstoreconnect-v1",
      bid: bundleId,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = crypto
    .createSign("SHA256")
    .update(signingInput)
    .end()
    .sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(signature)}`;
}

function appStoreBaseUrl() {
  return config.appStore.environment === "production"
    ? "https://api.storekit.apple.com"
    : "https://api.storekit-sandbox.apple.com";
}

function validateProductId(productId) {
  const allowed = config.appStore.productIds;
  if (allowed.length && !allowed.includes(productId)) {
    const error = new Error("허용되지 않은 Apple 상품 ID입니다.");
    error.status = 403;
    throw error;
  }
}

async function verifyApplePurchase({ transactionId, productId }) {
  if (!transactionId) {
    const error = new Error("Apple transactionId가 필요합니다.");
    error.status = 400;
    throw error;
  }

  const token = await appStoreJwt();
  const response = await fetch(`${appStoreBaseUrl()}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.errorMessage || body?.errorCode || `Apple 결제 검증 실패 HTTP ${response.status}`);
    error.status = response.status;
    error.raw = body;
    throw error;
  }

  const transaction = decodeJwsPayload(body.signedTransactionInfo);
  if (transaction.transactionId !== transactionId) {
    const error = new Error("Apple transactionId가 일치하지 않습니다.");
    error.status = 409;
    throw error;
  }
  if (config.appStore.bundleId && transaction.bundleId !== config.appStore.bundleId) {
    const error = new Error("Apple bundleId가 일치하지 않습니다.");
    error.status = 403;
    throw error;
  }
  if (productId && transaction.productId !== productId) {
    const error = new Error("Apple 상품 ID가 일치하지 않습니다.");
    error.status = 409;
    throw error;
  }
  validateProductId(transaction.productId);
  if (transaction.revocationDate) {
    const error = new Error("환불 또는 취소된 Apple 거래입니다.");
    error.status = 402;
    throw error;
  }

  return {
    provider: "app_store",
    providerOrderId: transaction.originalTransactionId || transaction.transactionId,
    providerTransactionId: transaction.transactionId,
    productId: transaction.productId,
    currency: transaction.currency || "KRW",
    quantity: Math.max(1, Number(transaction.quantity || 1)),
    rawResponse: { response: body, transaction },
  };
}

module.exports = { verifyApplePurchase };
