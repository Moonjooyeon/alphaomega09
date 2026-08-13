const crypto = require("node:crypto");

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function hashText(value) {
  if (!value) return null;
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function jsonError(message, extra = {}) {
  return { error: { message, ...extra } };
}

module.exports = { id, hashText, jsonError };
