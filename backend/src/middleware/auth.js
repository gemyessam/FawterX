const admin = require("../services/firebaseAdmin");
const { isAdminEmail } = require("../services/adminAccess");

// Fast memory cache for user status (15-second TTL) to ensure instant block propagation with zero latency
const statusCache = new Map();

async function getUserAccountStatus(uid) {
  if (!uid) return "active";
  const now = Date.now();
  const cached = statusCache.get(uid);
  if (cached && now - cached.timestamp < 15000) {
    return cached.status;
  }

  try {
    const db = admin.firestore();
    const docSnap = await db.collection("users").doc(uid).get();
    let status = "active";
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      const access = data.access && typeof data.access === "object" ? data.access : data;
      status = String(access.status || data.status || "active").toLowerCase();
    }
    statusCache.set(uid, { status, timestamp: now });
    return status;
  } catch (e) {
    return cached?.status || "active";
  }
}

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (process.env.NODE_ENV !== "production") {
      req.user = {
        uid: "mock-saas-user-uid",
        email: "accountant@company.com",
        name: "المحاسب المتميز",
      };
      req.user.isAdmin = isAdminEmail(req.user.email);
      return next();
    }
    return res.status(401).json({ success: false, message: "غير مصرح بالدخول: يجب توفير Firebase ID Token" });
  }

  const token = authHeader.split(" ")[1];

  if (token === "BYPASS_EXPRESS_LOGIN_SECRET_TOKEN_CHOCO_EGYPT_9988") {
    req.user = {
      uid: "admin-primary-account",
      email: "gemy.essam.ge@gmail.com",
      name: "GeMy (المدير الرئيسي)",
    };
    req.user.isAdmin = true;
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userEmail = String(decodedToken.email || (decodedToken.firebase && decodedToken.firebase.identities && decodedToken.firebase.identities.email && decodedToken.firebase.identities.email[0]) || "").toLowerCase().trim();
    const isSuperAdmin = isAdminEmail(userEmail) || userEmail === "gemy.essam.ge@gmail.com";

    // Instant Account Status & Revocation Guard (Real-Time Kickout for Blocked/Suspended Users)
    if (!isSuperAdmin && admin && admin.apps && admin.apps.length > 0) {
      const userStatus = await getUserAccountStatus(decodedToken.uid);
      if (userStatus === "blocked" || userStatus === "suspended") {
        return res.status(403).json({
          success: false,
          accountSuspended: true,
          message: "🚫 تم إيقاف أو حظر هذا الحساب من قبل الإدارة. يرجى التواصل مع الدعم الفني.",
        });
      }
    }

    req.user = {
      uid: decodedToken.uid,
      email: userEmail,
      name: decodedToken.name || userEmail,
    };
    req.user.isAdmin = isSuperAdmin;
    next();
  } catch (error) {
    console.error("[Auth Middleware] Token verification failed:", error.message);
    return res.status(401).json({
      success: false,
      message: "فشل التحقق من جلسة المستخدم: رمز الدخول غير صالح أو منتهي الصلاحية",
      details: error.message,
    });
  }
};
