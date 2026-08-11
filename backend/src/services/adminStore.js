const admin = require("./firebaseAdmin");
const { isAdminEmail } = require("./adminAccess");

function getDb() {
  try {
    if (admin && admin.apps && admin.apps.length > 0) {
      return admin.firestore();
    }
  } catch (err) {
    console.warn("Firestore is not available for admin store:", err.message);
  }
  return null;
}

function createFallbackAdminUser() {
  return {
    uid: "admin-primary-account",
    email: "gemy.essam.ge@gmail.com",
    displayName: "FawterX Admin",
    photoURL: "",
    submissionsCount: 0,
    dailyCount: 0,
    lastReset: null,
    lastSubmission: null,
    isSubscribed: true,
    role: "admin",
    status: "active",
    quotaDaily: 9999,
    quotaMonthly: 99999,
    expiresAt: null,
    note: "Primary platform administrator account",
    updatedAt: new Date().toISOString(),
  };
}

function ensurePrimaryAdmin(usersMap) {
  const adminEmail = "gemy.essam.ge@gmail.com";
  const hasAdminInMap = Object.values(usersMap).some(
    (u) => String(u.email || "").toLowerCase() === adminEmail
  );
  if (!hasAdminInMap) {
    usersMap["admin-primary-account"] = createFallbackAdminUser();
  }
}

function sanitizeUserSnapshot(doc) {
  const data = doc.data() || {};
  const access = data.access && typeof data.access === "object" ? data.access : data;
  const email = data.email || "";
  const isSuperAdmin = isAdminEmail(email) || email.toLowerCase() === "gemy.essam.ge@gmail.com";
  return {
    uid: doc.id,
    email,
    displayName: data.displayName || data.name || "",
    photoURL: data.photoURL || "",
    submissionsCount: data.submissionsCount || 0,
    dailyCount: data.dailyCount || 0,
    lastReset: data.lastReset || null,
    lastSubmission: data.lastSubmission || null,
    isSubscribed: Boolean(isSuperAdmin || access.isSubscribed || data.isSubscribed),
    role: isSuperAdmin ? "admin" : String(access.role || data.role || "user").toLowerCase(),
    status: String(access.status || data.status || "active").toLowerCase(),
    quotaDaily: isSuperAdmin ? 99999 : Number(access.quotaDaily ?? access.dailyLimit ?? data.quotaDaily ?? data.dailyLimit ?? 10),
    quotaMonthly: isSuperAdmin ? 999999 : (access.quotaMonthly ?? data.quotaMonthly ?? null),
    expiresAt: access.expiresAt || data.expiresAt || null,
    note: access.note || data.note || "",
    updatedAt: data.updatedAt || null,
    accessUpdatedAt: data.accessUpdatedAt || null,
    accessUpdatedBy: data.accessUpdatedBy || null,
  };
}

async function listUsers() {
  const db = getDb();
  const usersMap = {};

  if (db) {
    try {
      const snapshot = await db.collection("users").get();
      snapshot.docs.forEach((doc) => {
        usersMap[doc.id] = sanitizeUserSnapshot(doc);
      });
    } catch (err) {
      console.warn("Error fetching Firestore users:", err.message);
    }
  } else {
    console.warn("Firestore is not available; admin users will be loaded from Auth/fallback only.");
  }

  try {
    let pageToken = undefined;
    do {
      const page = await admin.auth().listUsers(1000, pageToken);
      page.users.forEach((u) => {
        const existing = usersMap[u.uid];
        const email = u.email || "";
        const displayName = u.displayName || email || u.uid;

        if (!existing) {
          usersMap[u.uid] = {
            uid: u.uid,
            email,
            displayName,
            photoURL: u.photoURL || "",
            submissionsCount: 0,
            dailyCount: 0,
            lastReset: null,
            lastSubmission: null,
            isSubscribed: false,
            role: isAdminEmail(email) ? "admin" : "user",
            status: "active",
            quotaDaily: 10,
            quotaMonthly: null,
            expiresAt: null,
            note: "",
            updatedAt: u.metadata?.creationTime || new Date().toISOString(),
          };

          if (db) {
            db.collection("users").doc(u.uid).set(
              {
                email,
                displayName,
                photoURL: u.photoURL || "",
                role: isAdminEmail(email) ? "admin" : "user",
                status: "active",
                createdAt: u.metadata?.creationTime || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            ).catch((e) => console.warn(`Auto-sync user ${u.uid} error:`, e.message));
          }
        } else {
          existing.email = existing.email || email;
          existing.displayName = existing.displayName || displayName;
          existing.photoURL = existing.photoURL || u.photoURL || "";
        }
      });
      pageToken = page.pageToken;
    } while (pageToken);
  } catch (err) {
    console.warn("Could not fetch auth users in bulk:", err.message);
  }

  ensurePrimaryAdmin(usersMap);

  return Object.values(usersMap).sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );
}

async function getUserById(uid) {
  const db = getDb();
  let user = null;

  if (db) {
    try {
      const doc = await db.collection("users").doc(uid).get();
      user = doc.exists ? sanitizeUserSnapshot(doc) : null;
    } catch (err) {
      console.warn(`Could not fetch Firestore user ${uid}:`, err.message);
    }
  }

  try {
    const authUser = await admin.auth().getUser(uid);
    const email = authUser.email || "";
    if (!user) {
      user = {
        uid: authUser.uid,
        email,
        displayName: authUser.displayName || email || authUser.uid,
        photoURL: authUser.photoURL || "",
        submissionsCount: 0,
        dailyCount: 0,
        lastReset: null,
        lastSubmission: null,
        isSubscribed: false,
        role: isAdminEmail(email) ? "admin" : "user",
        status: "active",
        quotaDaily: 10,
        quotaMonthly: null,
        expiresAt: null,
        note: "",
        updatedAt: authUser.metadata?.creationTime || new Date().toISOString(),
      };
    } else {
      user.email = user.email || email;
      user.displayName = user.displayName || authUser.displayName || email || "";
      user.photoURL = user.photoURL || authUser.photoURL || "";
    }
  } catch (err) {
    console.warn(`Could not fetch auth user ${uid}:`, err.message);
  }

  if (!user && uid === "admin-primary-account") {
    user = createFallbackAdminUser();
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
  const users = await listUsers();
  return {
    totalUsers: users.length,
    subscribedUsers: users.filter((u) => u.isSubscribed).length,
    suspendedUsers: users.filter((u) => u.status === "suspended" || u.status === "blocked").length,
    adminUsers: users.filter((u) => isAdminEmail(u.email) || u.role === "admin").length,
  };
}

module.exports = {
  listUsers,
  getUserById,
  updateUserAccess,
  getAdminStats,
};
