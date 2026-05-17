const admin = require("firebase-admin");

// تهيئة Firebase Admin SDK بمرونة فائقة لمنع الانهيار في حال عدم وجود ملف الإعدادات
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("=== Firebase Admin initialized successfully via env service account ===");
  } else {
    // محاولة التهيئة الافتراضية
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "mock-eta-saas-project"
    });
    console.log("=== Firebase Admin initialized via default or project ID ===");
  }
} catch (error) {
  console.warn("=== Firebase Admin initialization warning (running in sandbox mode) ===");
  // تهيئة وهمية أو تخطي لمنع تعطل تشغيل السيرفر
}

module.exports = admin;
