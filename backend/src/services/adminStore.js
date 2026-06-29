const admin = require("./firebaseAdmin");
const { isAdminEmail } = require("./adminAccess");

function getDb() {
  if (admin && admin.apps && admin.apps.length > 0) {
    return admin.firestore();
  }
  return null;
}

function sanitizeUserSnapshot(doc) {
  const data = doc.data() || {};
  const access = data.access && typeof data.access === "object" ? data.access : data;
  return {
    uid: doc.id,
    email: data.email || "",
    displayName: data.displayName || data.name || "",
    photoURL: data.photoURL || "",
    submissionsCount: data.submissionsCount || 0,
    dailyCount: data.dailyCount || 0,
    lastReset: data.lastReset || null,
    lastSubmission: data.lastSubmission || null,
    isSubscribed: Boolean(access.isSubscribed || data.isSubscribed),
    role: String(access.role || data.role || "user").toLowerCase(),
    status: String(access.status || data.status || "active").toLowerCase(),
    quotaDaily: Number(access.quotaDaily ?? access.dailyLimit ?? data.quotaDaily ?? data.dailyLimit ?? 10),
    quotaMonthly: access.quotaMonthly ?? data.quotaMonthly ?? null,
    expiresAt: access.expiresAt || data.expiresAt || null,
    note: access.note || data.note || "",
    updatedAt: data.updatedAt || null,
    accessUpdatedAt: data.accessUpdatedAt || null,
    accessUpdatedBy: data.accessUpdatedBy || null,
  };
}

async function listUsers() {
  const db = getDb();
  if (!db) return [];
  const snapshot = await db.collection("users").get();
  let usersList = snapshot.docs
    .map(sanitizeUserSnapshot)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 200);

  try {
    const authUsersMap = {};
    for (let i = 0; i < usersList.length; i += 100) {
      const batch = usersList.slice(i, i + 100).map(u => ({ uid: u.uid }));
      const authUsersResult = await admin.auth().getUsers(batch);
      authUsersResult.users.forEach(u => {
        authUsersMap[u.uid] = { email: u.email, displayName: u.displayName };
      });
    }

    usersList = usersList.map(u => {
      const authUser = authUsersMap[u.uid];
      return {
        ...u,
        email: u.email || (authUser && authUser.email) || "",
        displayName: u.displayName || (authUser && authUser.displayName) || "",
      };
    });
  } catch (err) {
    console.warn("Could not fetch auth users in bulk:", err.message);
  }

  return usersList;
}

async function getUserById(uid) {
  const db = getDb();
  if (!db) return null;
  const doc = await db.collection("users").doc(uid).get();
  if (!doc.exists) return null;
  const user = sanitizeUserSnapshot(doc);

  try {
    const authUser = await admin.auth().getUser(uid);
    user.email = user.email || authUser.email || "";
    user.displayName = user.displayName || authUser.displayName || "";
  } catch (err) {
    console.warn(`Could not fetch auth user ${uid}:`, err.message);
  }

  return user;
}

function clampPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function updateUserAccess(uid, payload = {}, actorEmail = "") {
  const db = getDb();
  if (!db) {
    throw new Error("Firestore is not available.");
  }

  const current = await getUserById(uid);
  if (!current) {
    throw new Error("User not found.");
  }

  const nextRole = ["user", "admin", "suspended"].includes(String(payload.role || current.role).toLowerCase())
    ? String(payload.role || current.role).toLowerCase()
    : current.role;
  const nextStatus = ["active", "suspended", "blocked"].includes(String(payload.status || current.status).toLowerCase())
    ? String(payload.status || current.status).toLowerCase()
    : current.status;

  const quotaDaily = clampPositiveInteger(
    payload.quotaDaily ?? payload.dailyLimit ?? current.quotaDaily,
    current.quotaDaily
  );
  const rawMonthly = payload.quotaMonthly ?? current.quotaMonthly;
  const quotaMonthly = rawMonthly === null || rawMonthly === "" ? null : clampPositiveInteger(rawMonthly, current.quotaMonthly);

  const expiresAt = payload.expiresAt === undefined ? current.expiresAt : (payload.expiresAt || null);
  const note = typeof payload.note === "string" ? payload.note.trim().slice(0, 500) : current.note;
  const isSubscribed = payload.isSubscribed === undefined ? current.isSubscribed : Boolean(payload.isSubscribed);

  const merged = {
    role: nextRole,
    status: nextStatus,
    isSubscribed,
    quotaDaily,
    quotaMonthly,
    expiresAt,
    note,
    accessUpdatedAt: new Date().toISOString(),
    accessUpdatedBy: actorEmail || "system",
  };

  await db.collection("users").doc(uid).set({
    role: nextRole,
    status: nextStatus,
    isSubscribed,
    quotaDaily,
    quotaMonthly,
    expiresAt,
    note,
    access: merged,
    accessUpdatedAt: merged.accessUpdatedAt,
    accessUpdatedBy: merged.accessUpdatedBy,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  return await getUserById(uid);
}

async function getAdminStats() {
  const db = getDb();
  if (!db) return { totalUsers: 0, subscribedUsers: 0, suspendedUsers: 0, adminUsers: 0 };
  const users = await listUsers();
  return {
    totalUsers: users.length,
    subscribedUsers: users.filter(u => u.isSubscribed).length,
    suspendedUsers: users.filter(u => u.status === "suspended" || u.status === "blocked").length,
    adminUsers: users.filter(u => isAdminEmail(u.email) || u.role === "admin").length,
  };
}

module.exports = {
  listUsers,
  getUserById,
  updateUserAccess,
  getAdminStats,
};
