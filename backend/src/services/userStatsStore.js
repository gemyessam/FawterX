const admin = require("./firebaseAdmin");
const { isAdminEmail } = require("./adminAccess");

// ═══════════════════════════════════════════════════════════════════
// Firestore-First User Stats Store
// كل البيانات مربوطة بـ userId في Firestore تحت users/{uid}
// ═══════════════════════════════════════════════════════════════════

function getDb() {
  try {
    if (admin && admin.apps && admin.apps.length > 0) {
      return admin.firestore();
    }
  } catch (e) {}
  return null;
}

function normalizeAccess(source = {}) {
  const access = source.access && typeof source.access === "object" ? source.access : source;
  const dailyLimit = Number(access.quotaDaily ?? access.dailyLimit ?? 10);
  const monthlyLimit = access.quotaMonthly == null || access.quotaMonthly === "" ? null : Number(access.quotaMonthly);
  const status = String(access.status || "active").toLowerCase();
  return {
    role: String(access.role || "user").toLowerCase(),
    status,
    isSubscribed: Boolean(access.isSubscribed),
    dailyLimit: Number.isFinite(dailyLimit) && dailyLimit >= 0 ? dailyLimit : 10,
    monthlyLimit: Number.isFinite(monthlyLimit) && monthlyLimit >= 0 ? monthlyLimit : null,
    expiresAt: access.expiresAt || null,
    note: access.note || "",
  };
}

/**
 * جلب حالة اشتراك واستخدام المستخدم الحالي
 */
async function getUserUsage(userId, userEmail) {
  const db = getDb();
  let data = { 
    submissionsCount: 0, 
    isSubscribed: false,
    role: "user",
    status: "active",
    dailyLimit: 10,
    monthlyLimit: null,
    dailyCount: 0,
    lastReset: new Date().toISOString().split('T')[0],
    isGm: isAdminEmail(userEmail)
  };

  if (db) {
    try {
      const docRef = db.collection("users").doc(userId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const d = docSnap.data();
        const access = normalizeAccess(d);
        data.submissionsCount = d.submissionsCount || 0;
        data.isSubscribed = access.isSubscribed || d.isSubscribed || false;
        data.role = access.role;
        data.status = access.status;
        data.dailyLimit = access.dailyLimit;
        data.monthlyLimit = access.monthlyLimit;
        const today = new Date().toISOString().split('T')[0];
        if (d.lastReset === today) {
          data.dailyCount = d.dailyCount || 0;
        } else {
          data.dailyCount = 0;
        }
      }
    } catch (e) {
      console.warn("Firestore error in getUserUsage:", e.message);
    }
  }

  if (isAdminEmail(userEmail)) {
    data.isSubscribed = true;
    data.role = "admin";
    data.status = "active";
    data.dailyLimit = 9999;
    data.monthlyLimit = null;
  }
  return data;
}

/**
 * يتحقق مما إذا كان للمستخدم الحق في الإرسال
 */
async function canUserSubmit(userId, userEmail) {
  if (isAdminEmail(userEmail)) return true;
  const userStat = await getUserUsage(userId, userEmail);
  if (userStat.status === "suspended" || userStat.status === "blocked") return false;
  if (userStat.isSubscribed) return true;
  return userStat.dailyCount < userStat.dailyLimit;
}

/**
 * يسجل إرسال ناجح للمستخدم ويزيد العداد
 */
async function recordSubmission(userId) {
  const db = getDb();
  if (db) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const docRef = db.collection("users").doc(userId);
      const docSnap = await docRef.get();
      let newDailyCount = 1;
      if (docSnap.exists) {
        const d = docSnap.data();
        if (d.lastReset === today) {
           newDailyCount = (d.dailyCount || 0) + 1;
        }
      }
      await docRef.set({
        submissionsCount: admin.firestore.FieldValue.increment(1),
        dailyCount: newDailyCount,
        lastReset: today,
        lastSubmission: new Date().toISOString()
      }, { merge: true });
      console.log(`[UserStats] ✅ Submission recorded for User: ${userId}`);
      return;
    } catch (e) {
      console.warn("Firestore error in recordSubmission:", e.message);
    }
  }
}

/**
 * يحفظ بيانات الشركة الخاصة بالمستخدم (الإصدار، النشاط، إلخ)
 */
async function saveUserProfile(userId, profileData) {
  const db = getDb();
  if (db) {
    try {
      const docRef = db.collection("users").doc(userId);
      await docRef.set({
        profile: profileData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return true;
    } catch (e) {
      console.warn("Firestore error in saveUserProfile:", e.message);
    }
  }
  return false;
}

const { encryptSecret, decryptSecret } = require("../utils/cryptoUtil");

/**
 * يحفظ إعدادات العميل (ClientId/Secrets) الخاصة بالمستخدم في Firestore بشكل مشفر وآمن
 */
async function saveUserSettings(userId, settingsData) {
  const db = getDb();
  if (!db) {
    throw new Error("لم يتم تهيئة قاعدة بيانات Firebase Admin SDK. يرجى التأكد من توفير مفتاح حساب الخدمة (Service Account JSON) بشكل صحيح.");
  }
  try {
    const payload = { ...settingsData };
    if (payload.clientSecret1) {
      payload.clientSecret1 = encryptSecret(payload.clientSecret1);
    }
    if (payload.clientSecret2) {
      payload.clientSecret2 = encryptSecret(payload.clientSecret2);
    }

    const docRef = db.collection("users").doc(userId);
    await docRef.set({
      companySettings: payload,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (e) {
    console.error("Firestore error in saveUserSettings:", e);
    throw new Error(`خطأ أثناء الحفظ في Firestore: ${e.message}`);
  }
}

/**
 * يجلب إعدادات العميل (ClientId/Secrets) الخاصة بالمستخدم من Firestore ويفك تشفير الأسرار
 */
async function getUserSettings(userId) {
  const db = getDb();
  if (!db) {
    throw new Error("لم يتم تهيئة قاعدة بيانات Firebase Admin SDK. يرجى التأكد من توفير مفتاح حساب الخدمة (Service Account JSON) بشكل صحيح.");
  }
  try {
    const docRef = db.collection("users").doc(userId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const settings = data.companySettings ? { ...data.companySettings } : null;
      if (settings) {
        if (settings.clientSecret1) {
          settings.clientSecret1 = decryptSecret(settings.clientSecret1);
        }
        if (settings.clientSecret2) {
          settings.clientSecret2 = decryptSecret(settings.clientSecret2);
        }
      }
      return settings;
    }
  } catch (e) {
    console.error("Firestore error in getUserSettings:", e);
    throw new Error(`خطأ أثناء جلب البيانات من Firestore: ${e.message}`);
  }
  return null;
}

module.exports = { canUserSubmit, recordSubmission, getUserUsage, saveUserProfile, saveUserSettings, getUserSettings };
