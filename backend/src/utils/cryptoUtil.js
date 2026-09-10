const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const MIN_KEY_LENGTH = 32;

let injectedKey = null;

/**
 * Explicit test key injection allowed STRICTLY when NODE_ENV === 'test'
 */
function setTestEncryptionKey(key) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("[Crypto] Test encryption key injection is permitted strictly when NODE_ENV === 'test'");
  }
  injectedKey = key;
}

/**
 * Resolves the primary raw encryption key from environment or test runner.
 * Enforces minimum length across all environments.
 * No silent fallback in test mode; requires explicit injection or ENCRYPTION_SECRET.
 */
function getPrimaryRawKey() {
  if (process.env.NODE_ENV === "test" && injectedKey !== null) {
    return injectedKey;
  }

  const rawKey = process.env.ENCRYPTION_SECRET;
  if (!rawKey || typeof rawKey !== "string" || rawKey.trim().length < MIN_KEY_LENGTH) {
    throw new Error(`[Crypto] ENCRYPTION_SECRET is required and must be at least ${MIN_KEY_LENGTH} characters long.`);
  }
  return rawKey;
}

function getKey() {
  const rawKey = getPrimaryRawKey();
  return crypto.createHash("sha256").update(rawKey).digest();
}

/**
 * Returns the legacy encryption key if explicitly configured via LEGACY_ENCRYPTION_SECRET.
 * Optional and decryption-only.
 */
function getLegacyKey() {
  const rawKey = process.env.LEGACY_ENCRYPTION_SECRET;
  if (!rawKey || typeof rawKey !== "string" || rawKey.trim().length === 0) {
    return null;
  }
  return crypto.createHash("sha256").update(rawKey).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Rejects caller-supplied strings starting with 'enc:' (only raw plaintext allowed).
 * Non-empty whitespace strings are encrypted; only exact empty string '' returns ''.
 * Returns: enc:gcm:iv:tag:ciphertext (all hex)
 */
function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined) {
    return plaintext;
  }
  if (typeof plaintext !== "string") {
    throw new TypeError("[Crypto] Invalid secret type: plaintext must be a string");
  }
  if (plaintext === "") {
    return "";
  }
  if (plaintext.startsWith("enc:")) {
    throw new Error("[Crypto] InvalidSecretFormat: raw secrets cannot start with reserved prefix 'enc:'");
  }

  const key = getKey();
  const iv = crypto.randomBytes(12); // 12-byte IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag().toString("hex");
  return `enc:gcm:${iv.toString("hex")}:${tag}:${encrypted}`;
}

function attemptDecrypt(iv, tag, encryptedHex, key) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Decrypt an AES-256-GCM ciphertext string.
 * Supports legacy plaintext if string does NOT start with 'enc:'.
 * Supports legacy key fallback if configured.
 * Never returns ciphertext or plaintext on decryption error.
 */
function decryptSecret(ciphertext) {
  if (ciphertext === null || ciphertext === undefined) {
    return ciphertext;
  }
  if (typeof ciphertext !== "string") {
    throw new TypeError("[Crypto] Invalid ciphertext type: must be a string");
  }
  if (!ciphertext.startsWith("enc:")) {
    // Pure legacy unencrypted plaintext compatibility
    return ciphertext;
  }
  if (!ciphertext.startsWith("enc:gcm:")) {
    throw new Error("[Crypto] MalformedEnvelope: unrecognized encryption prefix");
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 5) {
    throw new Error("[Crypto] MalformedEnvelope: invalid envelope structure");
  }

  const ivHex = parts[2];
  const tagHex = parts[3];
  const encryptedHex = parts[4];

  // 12 bytes = 24 hex chars; 16 bytes = 32 hex chars
  if (ivHex.length !== 24 || tagHex.length !== 32 || !/^[0-9a-fA-F]+$/.test(ivHex) || !/^[0-9a-fA-F]+$/.test(tagHex) || !/^[0-9a-fA-F]*$/.test(encryptedHex)) {
    throw new Error("[Crypto] MalformedEnvelope: invalid hex or component length");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  // Attempt primary key decryption
  const primaryKey = getKey();
  try {
    return attemptDecrypt(iv, tag, encryptedHex, primaryKey);
  } catch (primaryErr) {
    // Fallback to legacy key if configured
    const legacyKey = getLegacyKey();
    if (legacyKey) {
      try {
        return attemptDecrypt(iv, tag, encryptedHex, legacyKey);
      } catch (legacyErr) {
        // Fall through to error
      }
    }
    throw new Error("[Crypto] Decryption failed: invalid ciphertext, authentication tag mismatch, or unreadable key");
  }
}

module.exports = {
  encryptSecret,
  decryptSecret,
  getKey,
  getLegacyKey,
  setTestEncryptionKey,
  MIN_KEY_LENGTH,
};
