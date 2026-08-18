const crypto = require("crypto");

// 32-byte secret key derived from environment or fallback
const RAW_KEY = process.env.ENCRYPTION_SECRET || "FAWTERX_SECURE_ENCRYPTION_KEY_2026_PROD_9988_32BYTES";
const ALGORITHM = "aes-256-gcm";
const KEY = crypto.createHash("sha256").update(RAW_KEY).digest();

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns: enc:iv:authTag:ciphertext (in hex)
 */
function encryptSecret(plaintext) {
  if (!plaintext || typeof plaintext !== "string") return plaintext;
  if (plaintext.startsWith("enc:gcm:")) return plaintext; // Already encrypted

  try {
    const iv = crypto.randomBytes(12); // 12-byte IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const tag = cipher.getAuthTag().toString("hex");
    return `enc:gcm:${iv.toString("hex")}:${tag}:${encrypted}`;
  } catch (err) {
    console.error("[Crypto] Encryption error:", err.message);
    return plaintext;
  }
}

/**
 * Decrypt an AES-256-GCM ciphertext string
 */
function decryptSecret(ciphertext) {
  if (!ciphertext || typeof ciphertext !== "string") return ciphertext;
  if (!ciphertext.startsWith("enc:gcm:")) return ciphertext; // Not encrypted

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 5) return ciphertext;

    const ivHex = parts[2];
    const tagHex = parts[3];
    const encryptedHex = parts[4];

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("[Crypto] Decryption error:", err.message);
    return ciphertext;
  }
}

module.exports = {
  encryptSecret,
  decryptSecret,
};
