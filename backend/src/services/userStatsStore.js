const path = require("path");
const fs = require("fs");
const admin = require("./firebaseAdmin");

const STATS_FILE = path.join(__dirname, "../../userStats.json");

// Local fallback store helpers
function loadLocalStats() {
  if (!fs.existsSync(STATS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveLocalStats(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write local stats:", e);
  }
}

// Check if Firestore is available and active
function getFirestoreDb() {
  try {
    if (admin && admin.apps && admin.apps.length > 0) {
      return admin.firestore();
    }
  } catch (e) {
    // Firestore not initialized
  }
  return null;
}

/**
 * جلب حالة اشتراك واستخدام المستخدم الحالي
 */
async function getUserUsage(userId) {
  const db = getFirestoreDb();
  if (db) {
    try {
      const docRef = db.collection("userStats").doc(userId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        return docSnap.data();
      } else {
        // Return default structure
        return { submissionsCount: 0, isSubscribed: false };
      }
    } catch (e) {
      console.warn("Firestore error in getUserUsage, falling back to local store:", e);
    }
  }
  // Fallback to local store
  const stats = loadLocalStats();
  return stats[userId] || { submissionsCount: 0, isSubscribed: false };
}

/**
 * يتحقق مما إذا كان للمستخدم الحق في الإرسال (هل استهلك التجربة المجانية الأولى؟)
 */
async function canUserSubmit(userId) {
  const userStat = await getUserUsage(userId);
  if (userStat.isSubscribed) return true; // المشتركون لهم إرسال مفتوح
  return userStat.submissionsCount < 1; // غير المشتركين لديهم مرة واحدة مجانية
}

/**
 * يسجل إرسال ناجح للمستخدم ويزيد العداد
 */
async function recordSubmission(userId) {
  const userStat = await getUserUsage(userId);
  userStat.submissionsCount = (userStat.submissionsCount || 0) + 1;

  const db = getFirestoreDb();
  if (db) {
    try {
      const docRef = db.collection("userStats").doc(userId);
      await docRef.set(userStat, { merge: true });
      return userStat;
    } catch (e) {
      console.warn("Firestore error in recordSubmission, falling back to local store:", e);
    }
  }

  // Fallback to local store
  const stats = loadLocalStats();
  stats[userId] = userStat;
  saveLocalStats(stats);
  return userStat;
}

module.exports = { canUserSubmit, recordSubmission, getUserUsage };
