const fs = require("fs");
const path = require("path");

const STATS_FILE = path.join(__dirname, "../../userStats.json");

function loadStats() {
  if (!fs.existsSync(STATS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveStats(stats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf8");
}

/**
 * يتحقق مما إذا كان للمستخدم الحق في الإرسال (هل استهلك التجربة المجانية الأولى؟)
 */
function canUserSubmit(userId) {
  const stats = loadStats();
  const userStat = stats[userId] || { submissionsCount: 0, isSubscribed: false };
  
  if (userStat.isSubscribed) return true; // المشتركون لهم إرسال مفتوح
  return userStat.submissionsCount < 1; // غير المشتركين لديهم مرة واحدة مجانية
}

/**
 * يسجل إرسال ناجح للمستخدم ويزيد العداد
 */
function recordSubmission(userId) {
  const stats = loadStats();
  if (!stats[userId]) {
    stats[userId] = { submissionsCount: 0, isSubscribed: false };
  }
  stats[userId].submissionsCount += 1;
  saveStats(stats);
  return stats[userId];
}

/**
 * يجيب حالة اشتراك واستخدام المستخدم الحالي
 */
function getUserUsage(userId) {
  const stats = loadStats();
  return stats[userId] || { submissionsCount: 0, isSubscribed: false };
}

module.exports = { canUserSubmit, recordSubmission, getUserUsage };
