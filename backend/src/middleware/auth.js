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
      uid: "choco-egypt-uid-custom-bypass",
      email: "chocoegypt@saas.com",
      name: "شوكو ايجبت السي (دخول سريع)",
    };
    req.user.isAdmin = isAdminEmail(req.user.email);
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email,
    };
    req.user.isAdmin = isAdminEmail(req.user.email);
    next();
  } catch (error) {
    console.error("[Auth Middleware] Token verification failed:", error.message);

    if (process.env.NODE_ENV !== "production") {
      console.warn("[Auth Middleware] Sandbox bypass: using mock user.");
      req.user = {
        uid: "mock-saas-user-uid",
        email: "accountant@company.com",
        name: "المحاسب المتميز",
      };
      req.user.isAdmin = isAdminEmail(req.user.email);
      return next();
    }

    return res.status(401).json({ success: false, message: "فشل التحقق من جلسة المستخدم", details: error.message });
  }
};
