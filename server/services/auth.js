const crypto = require("node:crypto");
const config = require("../config");
const { findUserById } = require("./users");

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function b64urlJson(value) {
  return b64url(JSON.stringify(value));
}

function sign(payload) {
  return crypto.createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
}

function makeToken(user) {
  const payload = b64urlJson({
    sub: user.id,
    exp: Date.now() + TOKEN_TTL_MS,
  });
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".", 2);
  const expected = sign(payload);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (Number(claims.exp || 0) < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

function bearerToken(req) {
  const header = req.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function userFromToken(token) {
  const claims = verifyToken(token);
  if (!claims?.sub) return null;
  return findUserById(claims.sub);
}

async function optionalUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const user = await userFromToken(token);
  if (!user) {
    const error = new Error("로그인이 만료되었습니다. 다시 로그인해 주십시오.");
    error.status = 401;
    throw error;
  }
  return user;
}

async function requireUser(req) {
  const user = await optionalUser(req);
  if (!user) {
    const error = new Error("로그인이 필요합니다.");
    error.status = 401;
    throw error;
  }
  return user;
}

module.exports = { makeToken, optionalUser, requireUser, userFromToken };
