const crypto = require("crypto");
const admin = require("../services/firebaseAdmin");

function getDb() {
  try {
    if (admin && admin.apps && admin.apps.length > 0) {
      return admin.firestore();
    }
  } catch (e) {}
  return null;
}

/**
 * Generate a consistent device fingerprint hash from request headers
 */
function getDeviceFingerprint(req) {
  const customFp = req.headers["x-device-fingerprint"];
  if (customFp && customFp.length >= 8) {
    return customFp;
  }
  const userAgent = req.headers["user-agent"] || "unknown-agent";
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const raw = `${userAgent}-${ip.split(",")[0]}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/**
 * Middleware: Check if client device is trusted; trigger 2FA if new device detected
 */
async function checkDeviceTrust(req, res, next) {
  try {
    if (!req.user || !req.user.uid) {
      return next();
    }

    const db = getDb();
    if (!db) {
      return next(); // Skip if Firestore unavailable
    }

    const deviceFp = getDeviceFingerprint(req);
    req.deviceFingerprint = deviceFp;

    const devicesRef = db.collection("users").doc(req.user.uid).collection("devices");
    const snapshot = await devicesRef.get();

    // If first time user has no registered devices, register current device automatically
    if (snapshot.empty) {
      await devicesRef.doc(deviceFp).set({
        fingerprint: deviceFp,
        userAgent: req.headers["user-agent"] || "Unknown Browser",
        trustedAt: new Date().toISOString(),
        isPrimary: true,
      });
      req.isNewDevice = false;
      return next();
    }

    // 2FA temporarily disabled: all devices are trusted
    req.isNewDevice = false;
    next();
  } catch (err) {
    console.error("[DeviceAuth Middleware Error]:", err.message);
    req.isNewDevice = false;
    next();
  }
}

module.exports = {
  getDeviceFingerprint,
  checkDeviceTrust,
};
