const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

/**
 * Configure Helmet for Security HTTP Headers
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // Managed at hosting layer if needed
  crossOriginEmbedderPolicy: false,
});

/**
 * Rate Limiter to protect API against DDoS & Brute Force
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "تم تجاوز حد الطلبات المسموح به. يرجى الانتظار بضع دقائق وإعادة المحاولة.",
    details: "Too many requests from this IP, please try again after 15 minutes."
  }
});

/**
 * CORS Lockdown Options
 */
const allowedOrigins = [
  "https://fawterx.web.app",
  "https://fawterx.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173"
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests (e.g. mobile apps, curl, local signing agent)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith("http://localhost")) {
      callback(null, true);
    } else {
      callback(new Error("CORS policy violation: Access from this origin is denied."));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Device-Fingerprint", "X-Requested-With", "X-ETA-Client-Id", "X-ETA-Client-Secret"]
};

module.exports = {
  helmetMiddleware,
  apiLimiter,
  corsOptions
};
