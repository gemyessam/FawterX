const express = require("express");
const authMiddleware = require("../middleware/auth");
const { getDeviceFingerprint, checkDeviceTrust } = require("../middleware/deviceAuth");
const admin = require("../services/firebaseAdmin");
const { send2FAEmail } = require("../services/emailService");

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

function maskEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) return email || "";
  const [user, domain] = email.split("@");
  if (user.length <= 2) {
    return `${user.charAt(0)}*@${domain}`;
  }
  const stars = "*".repeat(Math.min(user.length - 2, 4));
  return `${user.charAt(0)}${stars}${user.slice(-1)}@${domain}`;
}

/**
 * GET /api/auth-security/device-status
 * Checks if current device is trusted or requires 2FA verification.
 * Automatically triggers an OTP email when a new device is detected.
 */
router.get("/device-status", async (req, res) => {
  try {
    const isNewDevice = req.isNewDevice || false;
    const deviceFp = req.deviceFingerprint || getDeviceFingerprint(req);
    const userEmail = req.user.email || "";

    if (isNewDevice) {
      const db = getDb();
      if (db) {
        const challengeRef = db.collection("users").doc(req.user.uid).collection("securityChallenges").doc(deviceFp);
        const snap = await challengeRef.get();
        const now = Date.now();

        let shouldSendEmail = false;
        let challengeCode = "";

        if (snap.exists) {
          const data = snap.data();
          const expiresAt = new Date(data.expiresAt).getTime();
          if (now < expiresAt) {
            challengeCode = data.code;
          }
        }

        if (!challengeCode) {
          // Generate fresh 6-digit cryptographic PIN code
          challengeCode = Math.floor(100000 + Math.random() * 900000).toString();
          await challengeRef.set({
            code: challengeCode,
            deviceFingerprint: deviceFp,
            createdAt: new Date().toISOString(),
            lastSentAt: new Date().toISOString(),
            expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
            attempts: 0,
          });
          shouldSendEmail = true;
        }

        if (shouldSendEmail && userEmail) {
          send2FAEmail({
            toEmail: userEmail,
            code: challengeCode,
            deviceDetails: {
              userAgent: req.headers["user-agent"] || "متصفح الويب",
              ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
            },
          }).catch((e) => console.error("[2FA Email Error]:", e.message));
        }
      }
    }

    return res.json({
      success: true,
      userEmail,
      emailMasked: maskEmail(userEmail),
      isNewDevice,
      deviceFingerprint: deviceFp,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/auth-security/resend-code
 * Resends the 6-digit security OTP to the user's email (Rate-limited with 60s cooldown)
 */
router.post("/resend-code", async (req, res) => {
  try {
    const deviceFp = req.deviceFingerprint || getDeviceFingerprint(req);
    const userEmail = req.user.email || "";
    const db = getDb();

    if (!db) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة." });
    }

    const challengeRef = db.collection("users").doc(req.user.uid).collection("securityChallenges").doc(deviceFp);
    const snap = await challengeRef.get();
    const now = Date.now();

    if (snap.exists) {
      const data = snap.data();
      const lastSentAt = data.lastSentAt ? new Date(data.lastSentAt).getTime() : 0;
      const cooldownMs = 60 * 1000;

      if (now - lastSentAt < cooldownMs) {
        const remainingSec = Math.ceil((cooldownMs - (now - lastSentAt)) / 1000);
        return res.status(429).json({
          success: false,
          message: `يرجى الانتظار ${remainingSec} ثانية قبل إعادة طلب رمز أمان جديد.`,
          retryAfterSec: remainingSec,
        });
      }
    }

    // Generate new 6-digit code
    const challengeCode = Math.floor(100000 + Math.random() * 900000).toString();
    await challengeRef.set({
      code: challengeCode,
      deviceFingerprint: deviceFp,
      createdAt: new Date().toISOString(),
      lastSentAt: new Date().toISOString(),
      expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
      attempts: 0,
    });

    if (userEmail) {
      await send2FAEmail({
        toEmail: userEmail,
        code: challengeCode,
        deviceDetails: {
          userAgent: req.headers["user-agent"] || "متصفح الويب",
          ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
        },
      });
    }

    return res.json({
      success: true,
      message: "تم إرسال رمز التحقق الجديد إلى بريدك الإلكتروني بنجاح.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/auth-security/verify-2fa
 * Verifies the 6-digit security code and marks the device as trusted
 */
router.post("/verify-2fa", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || code.trim().length !== 6) {
      return res.status(400).json({ success: false, message: "رمز التحقق يجب أن يتكون من 6 أرقام." });
    }

    const deviceFp = req.deviceFingerprint || getDeviceFingerprint(req);
    const db = getDb();
    if (!db) {
      return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة." });
    }

    const challengeRef = db.collection("users").doc(req.user.uid).collection("securityChallenges").doc(deviceFp);
    const snap = await challengeRef.get();

    if (!snap.exists) {
      return res.status(400).json({ success: false, message: "طلب التحقق غير صالح أو انتهت صلاحيته. يُرجى إعادة طلب رمز جديد." });
    }

    const challengeData = snap.data();
    const now = Date.now();
    const expiresAt = challengeData.expiresAt ? new Date(challengeData.expiresAt).getTime() : 0;

    if (now > expiresAt) {
      await challengeRef.delete();
      return res.status(400).json({ success: false, message: "انتهت صلاحية رمز التحقق. يرجى طلب رمز أمان جديد." });
    }

    const currentAttempts = (challengeData.attempts || 0) + 1;
    if (currentAttempts > 5) {
      await challengeRef.delete();
      return res.status(400).json({
        success: false,
        message: "تم تجاوز الحد الأقصى للمحاولات الخاطئة. تم إلغاء الرمز لأسباب أمنية، يرجى طلب رمز جديد.",
      });
    }

    if (challengeData.code !== code.trim()) {
      await challengeRef.update({ attempts: currentAttempts });
      const remaining = 5 - currentAttempts;
      return res.status(400).json({
        success: false,
        message: `رمز التحقق غير صحيح! يتبقى لديك ${remaining} ${remaining === 1 ? "محاولة" : "محاولات"}.`,
      });
    }

    // Code matches! Register device as trusted
    const devicesRef = db.collection("users").doc(req.user.uid).collection("devices");
    await devicesRef.doc(deviceFp).set({
      fingerprint: deviceFp,
      userAgent: req.headers["user-agent"] || "Trusted Browser",
      trustedAt: new Date().toISOString(),
      verifiedVia2FA: true,
    });

    // Delete challenge immediately upon success
    await challengeRef.delete();

    console.log(`[Security 2FA] ✅ Device (FP: ${deviceFp}) successfully authorized via OTP for ${req.user.email}`);

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
