const admin = require("./firebaseAdmin");

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

/**
 * جلب حالة اشتراك واستخدام المستخدم الحالي
 */
async function getUserUsage(userId, userEmail) {
  const db = getDb();
  let data = { 
    submissionsCount: 0, 
    isSubscribed: false,
    dailyCount: 0,
    lastReset: new Date().toISOString().split('T')[0],
    isGm: userEmail === 'gemy.essam.ge@gmail.com'
  };

  if (db) {
    try {
      const docRef = db.collection("users").doc(userId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const d = docSnap.data();
        data.submissionsCount = d.submissionsCount || 0;
        data.isSubscribed = d.isSubscribed || false;
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

  if (userEmail === 'gemy.essam.ge@gmail.com') {
    data.isSubscribed = true;
  }
  return data;
}

/**
 * يتحقق مما إذا كان للمستخدم الحق في الإرسال
 */
async function canUserSubmit(userId, userEmail) {
  if (userEmail === 'gemy.essam.ge@gmail.com') return true;
  const userStat = await getUserUsage(userId, userEmail);
  if (userStat.isSubscribed) return true;
  return userStat.dailyCount < 10;
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

/**
 * يحفظ إعدادات العميل (ClientId/Secrets) الخاصة بالمستخدم في Firestore بشكل آمن
 */
async function saveUserSettings(userId, settingsData) {
  const db = getDb();
  if (!db) {
    throw new Error("لم يتم تهيئة قاعدة بيانات Firebase Admin SDK. يرجى التأكد من توفير مفتاح حساب الخدمة (Service Account JSON) بشكل صحيح.");
  }
  try {
    const docRef = db.collection("users").doc(userId);
    await docRef.set({
      companySettings: settingsData,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (e) {
    console.error("Firestore error in saveUserSettings:", e);
    throw new Error(`خطأ أثناء الحفظ في Firestore: ${e.message}`);
  }
}

/**
 * يجلب إعدادات العميل (ClientId/Secrets) الخاصة بالمستخدم من Firestore
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
      return data.companySettings || null;
    }
  } catch (e) {
    console.error("Firestore error in getUserSettings:", e);
    throw new Error(`خطأ أثناء جلب البيانات من Firestore: ${e.message}`);
  }
  return null;
}

module.exports = { canUserSubmit, recordSubmission, getUserUsage, saveUserProfile, saveUserSettings, getUserSettings };
