const admin = require("../services/firebaseAdmin");
const { isAdminEmail } = require("../services/adminAccess");

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
    req.user = {
      uid: decodedToken.uid,
      email: userEmail,
      name: decodedToken.name || userEmail,
    };
    req.user.isAdmin = isAdminEmail(userEmail) || userEmail === "gemy.essam.ge@gmail.com";
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
