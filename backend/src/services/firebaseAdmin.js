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
    // محاولة التهيئة الافتراضية باستخدام المشروع الفعلي لـ FawterX لتسهيل عملية التحقق التلقائي
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "fawterx"
    });
    console.log("=== Firebase Admin initialized via default or project ID ===");
  }
} catch (error) {
  console.warn("=== Firebase Admin initialization warning (running in sandbox mode) ===");
  // تهيئة وهمية أو تخطي لمنع تعطل تشغيل السيرفر
}

module.exports = admin;
