const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// تهيئة Firebase Admin SDK بمرونة فائقة لمنع الانهيار
try {
  const localCredPath = path.join(__dirname, "../../firebase-service-account.json");
  const localCredPath2 = path.join(__dirname, "../firebase-service-account.json");
  const localCredPath3 = path.join(__dirname, "firebase-service-account.json");
  
  let serviceAccount = null;
  
  if (fs.existsSync(localCredPath)) {
    serviceAccount = require(localCredPath);
    console.log("=== Firebase Admin loaded local key from parent workspace ===");
  } else if (fs.existsSync(localCredPath2)) {
    serviceAccount = require(localCredPath2);
    console.log("=== Firebase Admin loaded local key from backend directory ===");
  } else if (fs.existsSync(localCredPath3)) {
    serviceAccount = require(localCredPath3);
    console.log("=== Firebase Admin loaded local key from active subfolder ===");
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("=== Firebase Admin loaded key from environment variable ===");
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("=== Firebase Admin initialized successfully via Service Account certificate ===");
  } else {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "fawterx"
    });
    console.log("=== Firebase Admin initialized via default Project ID (Sandbox) ===");
  }
} catch (error) {
  console.warn("=== Firebase Admin initialization warning (running in sandbox mode) ===", error.message);
}

module.exports = admin;
