const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const config = require("../config");

const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

async function serviceAccount() {
  const raw = config.playStore.serviceAccountJson
    || (config.playStore.serviceAccountJsonPath
      ? await fs.readFile(config.playStore.serviceAccountJsonPath, "utf8")
      : "");
  if (!raw) {
    const error = new Error("Google Play 결제 검증 서비스 계정이 설정되지 않았습니다.");
    error.status = 500;
    throw error;
  }
  const account = JSON.parse(raw);
  if (!account.client_email || !account.private_key) {
    const error = new Error("Google 서비스 계정 JSON에 client_email/private_key가 없습니다.");
    error.status = 500;
    throw error;
  }
  account.private_key = account.private_key.replace(/\\n/g, "\n");
  return account;
}

async function googleAccessToken() {
  const account = await serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = account.token_uri || "https://oauth2.googleapis.com/token";
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: ANDROID_PUBLISHER_SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).end().sign(account.private_key);
  const assertion = `${signingInput}.${b64url(signature)}`;
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    const error = new Error(body?.error_description || body?.error || "Google access token 발급에 실패했습니다.");
    error.status = response.status || 500;
    error.raw = body;
    throw error;
  }
  return body.access_token;
}

function validateProductId(productId) {
  const allowed = config.playStore.productIds;
  if (allowed.length && !allowed.includes(productId)) {
    const error = new Error("허용되지 않은 Google 상품 ID입니다.");
    error.status = 403;
    throw error;
  }
}

async function verifyGooglePurchase({ packageName, productId, purchaseToken }) {
  const appPackage = packageName || config.playStore.packageName;
  if (!appPackage) {
    const error = new Error("Google packageName이 필요합니다.");
    error.status = 400;
    throw error;
  }
  if (!productId || !purchaseToken) {
    const error = new Error("Google productId와 purchaseToken이 필요합니다.");
    error.status = 400;
    throw error;
  }
  validateProductId(productId);

  const token = await googleAccessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(appPackage)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || `Google Play 결제 검증 실패 HTTP ${response.status}`);
    error.status = response.status;
    error.raw = body;
    throw error;
  }
  if (body.purchaseState !== 0) {
    const error = new Error("구매 완료 상태가 아닌 Google Play 거래입니다.");
    error.status = 402;
    throw error;
  }

  return {
    provider: "play_store",
    providerOrderId: body.orderId || purchaseToken,
    providerTransactionId: purchaseToken,
    productId,
    currency: "KRW",
    quantity: Math.max(1, Number(body.quantity || 1)),
    rawResponse: { packageName: appPackage, purchase: body },
  };
}

module.exports = { verifyGooglePurchase };
