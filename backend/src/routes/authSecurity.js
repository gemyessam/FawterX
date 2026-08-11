const express = require("express");
const authMiddleware = require("../middleware/auth");
const { getDeviceFingerprint, checkDeviceTrust } = require("../middleware/deviceAuth");
const admin = require("../services/firebaseAdmin");

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
 * Checks if current device is trusted or requires 2FA verification
 */
router.get("/device-status", async (req, res) => {
  try {
    const isNewDevice = req.isNewDevice || false;
    const deviceFp = req.deviceFingerprint || getDeviceFingerprint(req);

    // If new device, generate a 6-digit security code challenge if not already pending
    let challengeCode = "";
    if (isNewDevice) {
      const db = getDb();
      if (db) {
        const challengeRef = db.collection("users").doc(req.user.uid).collection("securityChallenges").doc(deviceFp);
        const snap = await challengeRef.get();
        if (snap.exists) {
          challengeCode = snap.data().code;
        } else {
          // Generate 6-digit PIN code
          challengeCode = Math.floor(100000 + Math.random() * 900000).toString();
          await challengeRef.set({
            code: challengeCode,
            deviceFingerprint: deviceFp,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          });
        }
      }
    }

    return res.json({
      success: true,
      userEmail: req.user.email,
      isNewDevice,
      deviceFingerprint: deviceFp,
      challengeCodeDemo: isNewDevice ? challengeCode : null, // Displayed in security modal demo for seamless UX
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/auth-security/verify-2fa
 * Verifies the 6-digit security code and trusts the new device
 */
router.post("/verify-2fa", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.trim().length !== 6) {
      return res.status(400).json({ success: false, message: "رمز الأمان يجب أن يتكون من 6 أرقام." });
    }

    const deviceFp = req.deviceFingerprint || getDeviceFingerprint(req);
    const db = getDb();
    if (!db) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة." });
    }

    const challengeRef = db.collection("users").doc(req.user.uid).collection("securityChallenges").doc(deviceFp);
    const snap = await challengeRef.get();

    if (!snap.exists) {
      return res.status(400).json({ success: false, message: "طلب التحقق غير صالح أو انتهت صلاحيته." });
    }

    const challengeData = snap.data();
    if (challengeData.code !== code.trim()) {
      return res.status(400).json({ success: false, message: "رمز الأمان غير صحيح! حاول مرة أخرى." });
    }

    // Code matches! Register device as trusted
    const devicesRef = db.collection("users").doc(req.user.uid).collection("devices");
    await devicesRef.doc(deviceFp).set({
      fingerprint: deviceFp,
      userAgent: req.headers["user-agent"] || "Trusted Browser",
      trustedAt: new Date().toISOString(),
      verifiedVia2FA: true,
    });

    // Delete challenge
    await challengeRef.delete();

    console.log(`[Security 2FA] ✅ Device (FP: ${deviceFp}) successfully authorized for ${req.user.email}`);

    return res.json({
      success: true,
      message: "تم التحقق وتأمين الجهاز الجديد بنجاح!",
      deviceFingerprint: deviceFp,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
