const admin = require("../services/firebaseAdmin");

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("[Auth Middleware] Missing or malformed Authorization header.");
    // إذا لم تكن هناك تهيئة حقيقية لـ Firebase Admin، نسمح بالمرور في بيئة التطوير كمستخدم تجريبي
    if (process.env.NODE_ENV === "development" || !process.env.FIREBASE_SERVICE_ACCOUNT) {
      req.user = {
        uid: "mock-saas-user-uid",
        email: "accountant@company.com",
        name: "المحاسب المتميز"
      };
      return next();
    }
    return res.status(401).json({ success: false, message: "غير مصرح بالدخول: يجب توفير Firebase ID Token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email
    };
    next();
  } catch (error) {
    console.error("[Auth Middleware] Token verification failed:", error.message);
    
    // وضع المطورين المرن
    if (process.env.NODE_ENV === "development" || !process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.warn("[Auth Middleware] Sandbox bypass: using mock user.");
      req.user = {
        uid: "mock-saas-user-uid",
        email: "accountant@company.com",
        name: "المحاسب المتميز"
      };
      return next();
    }
    
    return res.status(401).json({ success: false, message: "فشل التحقق من جلسة المستخدم", details: error.message });
  }
};
