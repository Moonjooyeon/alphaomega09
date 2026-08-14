const config = require("../config");
const { pool } = require("../db");
const { id } = require("../utils");
const { verifyApplePurchase } = require("./apple");
const { verifyGooglePurchase } = require("./google");
const { createPassForOrder, toPublicPass } = require("./passes");

function normalizeProvider(provider) {
  const value = String(provider || config.billing.paymentProvider || "app_store").trim().toLowerCase();
  if (["apple", "ios", "app_store", "appstore"].includes(value)) return "app_store";
  if (["google", "android", "play_store", "playstore", "google_play"].includes(value)) return "play_store";
  return value;
}

function publicOrder(row) {
  return {
    id: row.id,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    providerTransactionId: row.provider_transaction_id,
    productId: row.product_id,
    amountKrw: Number(row.amount_krw || 0),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
  };
}

async function createManualPurchase({ userId, providerOrderId, providerTransactionId, productId, amountKrw, rawResponse }) {
  if (!config.billing.purchaseMock) {
    const error = new Error("수동 이용권 발급은 PURCHASE_MOCK=true에서만 사용할 수 있습니다.");
    error.status = 403;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const order = await client.query(
      `
        INSERT INTO purchase_orders (
          id, user_id, provider, provider_order_id, provider_transaction_id, product_id,
          amount_krw, currency, status, raw_response, approved_at
        )
        VALUES ($1, $2, 'manual', $3, $4, $5, $6, 'KRW', 'approved', $7, now())
        ON CONFLICT (provider, provider_transaction_id) DO UPDATE
        SET raw_response = purchase_orders.raw_response
        RETURNING *
      `,
      [
        id("order"),
        userId,
        providerOrderId || id("manual_order"),
        providerTransactionId || id("manual_tx"),
        productId || "manual_pass",
        Number(amountKrw || 0),
        rawResponse || { mock: true },
      ]
    );
    if (order.rows[0].user_id !== userId) {
      const error = new Error("이미 다른 사용자에게 처리된 결제 거래입니다.");
      error.status = 409;
      throw error;
    }

    const existingPass = await client.query("SELECT * FROM access_passes WHERE order_id = $1 LIMIT 1", [order.rows[0].id]);
    const pass = existingPass.rowCount
      ? existingPass.rows[0]
      : await createPassForOrder(client, {
          userId,
          orderId: order.rows[0].id,
          allowedUses: config.billing.passUsesPerPurchase,
        });

    await client.query("COMMIT");

    return {
      order: publicOrder(order.rows[0]),
      pass: toPublicPass(pass),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function recordApprovedPurchase({ userId, verified, amountKrw = 0 }) {
  const allowedUses = config.billing.passUsesPerPurchase * Math.max(1, Number(verified.quantity || 1));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const order = await client.query(
      `
        INSERT INTO purchase_orders (
          id, user_id, provider, provider_order_id, provider_transaction_id, product_id,
          amount_krw, currency, status, raw_response, approved_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved', $9, now())
        ON CONFLICT (provider, provider_transaction_id) DO UPDATE
        SET raw_response = EXCLUDED.raw_response
        RETURNING *
      `,
      [
        id("order"),
        userId,
        verified.provider,
        verified.providerOrderId || verified.providerTransactionId,
        verified.providerTransactionId,
        verified.productId,
        Number(amountKrw || 0),
        verified.currency || "KRW",
        verified.rawResponse || {},
      ]
    );
    if (order.rows[0].user_id !== userId) {
      const error = new Error("이미 다른 사용자에게 처리된 결제 거래입니다.");
      error.status = 409;
      throw error;
    }

    const existingPass = await client.query("SELECT * FROM access_passes WHERE order_id = $1 LIMIT 1", [order.rows[0].id]);
    const pass = existingPass.rowCount
      ? existingPass.rows[0]
      : await createPassForOrder(client, {
          userId,
          orderId: order.rows[0].id,
          allowedUses,
        });

    await client.query("COMMIT");

    return {
      order: publicOrder(order.rows[0]),
      pass: toPublicPass(pass),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function grantIapPass({ userId, orderId, sku, displayName, displayAmount, amount }) {
  if (!orderId) {
    const error = new Error("Apps in Toss IAP orderId가 필요합니다.");
    error.status = 400;
    throw error;
  }
  return recordApprovedPurchase({
    userId,
    amountKrw: Number(amount || 0),
    verified: {
      provider: "apps_in_toss_iap",
      providerOrderId: orderId,
      providerTransactionId: `iap:${orderId}`,
      productId: sku || "apps_in_toss_pass",
      currency: "KRW",
      quantity: 1,
      rawResponse: {
        provider: "apps_in_toss_iap",
        orderId,
        sku,
        displayName,
        displayAmount,
        amount,
      },
    },
  });
}

async function verifyPurchase(payload) {
  const provider = normalizeProvider(payload.provider);
  if (provider === "manual") {
    return createManualPurchase(payload);
  }
  if (provider === "app_store") {
    const verified = await verifyApplePurchase(payload);
    return recordApprovedPurchase({ userId: payload.userId, verified, amountKrw: payload.amountKrw });
  }
  if (provider === "play_store") {
    const verified = await verifyGooglePurchase(payload);
    return recordApprovedPurchase({ userId: payload.userId, verified, amountKrw: payload.amountKrw });
  }

  const error = new Error(`${provider} 결제 검증은 아직 구현되지 않았습니다.`);
  error.status = 501;
  throw error;
}

module.exports = { grantIapPass, verifyPurchase };
