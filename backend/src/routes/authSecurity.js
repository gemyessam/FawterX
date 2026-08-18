const express = require("express");
const authMiddleware = require("../middleware/auth");
const { getDeviceFingerprint, checkDeviceTrust } = require("../middleware/deviceAuth");
const admin = require("../services/firebaseAdmin");
const { generateTotpSetup, verifyTotpToken } = require("../services/totpService");

const router = express.Router();
router.use(express.json());
router.use(authMiddleware);
router.use(checkDeviceTrust);

function getDb() {
  try {
    if (admin && admin.apps && admin.apps.length > 0) {
      return admin.firestore();
    }
  } catch (e) {}
  return null;
}

/**
 * GET /api/auth-security/device-status
 * Checks if current device is trusted or requires TOTP (Google Authenticator) 2FA
 */
router.get("/device-status", async (req, res) => {
  try {
    const isNewDevice = req.isNewDevice || false;
    const deviceFp = req.deviceFingerprint || getDeviceFingerprint(req);
    const userEmail = req.user.email || "";

    if (!isNewDevice) {
      return res.json({
        success: true,
        userEmail,
        isNewDevice: false,
        deviceFingerprint: deviceFp,
      });
    }

    const db = getDb();
    if (!db) {
      return res.json({
        success: true,
        userEmail,
        isNewDevice: false,
        deviceFingerprint: deviceFp,
      });
    }

    const userDocRef = db.collection("users").doc(req.user.uid);
    const userSnap = await userDocRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};

    // Check if user already has an active TOTP secret configured
    if (userData.totpEnabled && userData.totpSecret) {
      return res.json({
        success: true,
        userEmail,
        isNewDevice: true,
        needsTotpSetup: false,
        deviceFingerprint: deviceFp,
      });
    }

    // User does not have TOTP setup yet -> generate new QR code & secret
    const setup = await generateTotpSetup(userEmail);
    await userDocRef.set(
      {
        pendingTotpSecret: setup.secret,
        email: userEmail,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.json({
      success: true,
      userEmail,
      isNewDevice: true,
      needsTotpSetup: true,
      qrCode: setup.qrCodeDataUrl,
      secretText: setup.secret,
      deviceFingerprint: deviceFp,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/auth-security/verify-2fa
 * Verifies the 6-digit TOTP code from Google Authenticator and registers the device
 */
router.post("/verify-2fa", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.toString().trim().length !== 6) {
      return res.status(400).json({ success: false, message: "رمز المصادقة يجب أن يتكون من 6 أرقام." });
    }

    const deviceFp = req.deviceFingerprint || getDeviceFingerprint(req);
    const db = getDb();
    if (!db) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة." });
    }

    const userDocRef = db.collection("users").doc(req.user.uid);
    const userSnap = await userDocRef.get();
    if (!userSnap.exists) {
      return res.status(400).json({ success: false, message: "حساب المستخدم غير موجود." });
    }

    const userData = userSnap.data();
    const activeSecret = (userData.totpEnabled && userData.totpSecret) || userData.pendingTotpSecret;

    if (!activeSecret) {
      return res.status(400).json({
        success: false,
        message: "لم يتم العثور على مفتاح مصادقة للحساب. يرجى إعادة تحميل الصفحة.",
      });
    }

    const isValid = verifyTotpToken(code, activeSecret);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "رمز المصادقة غير صحيح! تأكد من كتابة الرمز الحالي الظاهر في تطبيق Google Authenticator.",
      });
    }

    // Code is valid! Save secret permanently & mark TOTP enabled
    const batch = db.batch();
    batch.set(
      userDocRef,
      {
        totpSecret: activeSecret,
        totpEnabled: true,
        pendingTotpSecret: admin.firestore.FieldValue.delete(),
        totpActivatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Register device as trusted
    const deviceRef = db.collection("users").doc(req.user.uid).collection("devices").doc(deviceFp);
    batch.set(
      deviceRef,
      {
        fingerprint: deviceFp,
        userAgent: req.headers["user-agent"] || "Trusted Device",
        trustedAt: new Date().toISOString(),
        verifiedViaTOTP: true,
      },
      { merge: true }
    );

    await batch.commit();

    console.log(`[Security TOTP] ✅ Device (FP: ${deviceFp}) successfully authorized via Google Authenticator for ${req.user.email}`);

    return res.json({
      success: true,
      message: "تم التحقق وتوثيق الجهاز بنجاح! 🛡️",
      deviceFingerprint: deviceFp,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
