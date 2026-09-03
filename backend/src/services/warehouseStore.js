const admin = require("./firebaseAdmin");
const { isAdminEmail } = require("./adminAccess");

function getDb() {
  if (admin && admin.apps && admin.apps.length > 0) {
    return admin.firestore();
  }
  return null;
}

/**
 * Get warehouse permission status for a user
 */
async function getUserWarehouseAccess(uid, email) {
  if (isAdminEmail(email)) {
    return {
      enabled: true,
      role: "admin",
      isAdmin: true,
      allowedProjects: ["*"],
      canDelete: true,
      canEdit: true,
      canUpload: true,
    };
  }

  const db = getDb();
  if (!db || !uid) {
    return { enabled: false, role: "disabled", isAdmin: false, allowedProjects: [] };
  }

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return { enabled: false, role: "disabled", isAdmin: false, allowedProjects: [] };
    }

    const data = userDoc.data() || {};
    const access = data.access && typeof data.access === "object" ? data.access : data;

    // Strict priority 1: If warehouseEnabled is explicitly false or role is disabled, deny immediately
    if (
      data.warehouseEnabled === false ||
      access.warehouseEnabled === false ||
      data.warehouseRole === "disabled" ||
      access.warehouseRole === "disabled"
    ) {
      return { enabled: false, role: "disabled", isAdmin: false, allowedProjects: [] };
    }

    const isEnabled = Boolean(
      data.warehouseEnabled ??
      access.warehouseEnabled ??
      (data.warehouseRole && data.warehouseRole !== "disabled") ??
      (access.warehouseRole && access.warehouseRole !== "disabled")
    );

    if (!isEnabled) {
      return { enabled: false, role: "disabled", isAdmin: false, allowedProjects: [] };
    }

    const warehouseRole = String(
      data.warehouseRole || access.warehouseRole || "warehouse_operator"
    );

    const isWarehouseAdmin = warehouseRole === "admin";
    const allowedProjects = Array.isArray(data.allowedProjects)
      ? data.allowedProjects
      : (Array.isArray(access.allowedProjects) ? access.allowedProjects : ["*"]);

    return {
      enabled: true,
      role: warehouseRole,
      isAdmin: isWarehouseAdmin,
      allowedProjects,
      canDelete: typeof data.canDelete === "boolean" ? data.canDelete : (typeof access.canDelete === "boolean" ? access.canDelete : true),
      canEdit: typeof data.canEdit === "boolean" ? data.canEdit : (typeof access.canEdit === "boolean" ? access.canEdit : true),
      canUpload: typeof data.canUpload === "boolean" ? data.canUpload : (typeof access.canUpload === "boolean" ? access.canUpload : true),
      canDispatch: typeof data.canDispatch === "boolean" ? data.canDispatch : (typeof access.canDispatch === "boolean" ? access.canDispatch : true),
      canManual: typeof data.canManual === "boolean" ? data.canManual : (typeof access.canManual === "boolean" ? access.canManual : true),
    };
  } catch (err) {
    console.error("Error getting warehouse access:", err.message);
    return { enabled: false, role: "disabled", isAdmin: false, allowedProjects: [] };
  }
}

/**
 * List all users with their warehouse permissions (For Admin UI)
 */
async function listWarehouseUsers() {
  const db = getDb();
  if (!db) return [];

  const allUsersMap = {};

  try {
    const snapshot = await db.collection("users").get();
    snapshot.docs.forEach((doc) => {
      allUsersMap[doc.id] = doc.data() || {};
    });
  } catch (e) {
    console.warn("Error fetching Firestore users for warehouse:", e.message);
  }

  try {
    let pageToken = undefined;
    do {
      const page = await admin.auth().listUsers(1000, pageToken);
      page.users.forEach((u) => {
        if (!allUsersMap[u.uid]) {
          allUsersMap[u.uid] = {
            email: u.email || "",
            displayName: u.displayName || u.email || u.uid,
            role: isAdminEmail(u.email) ? "admin" : "user",
          };
        } else {
          allUsersMap[u.uid].email = allUsersMap[u.uid].email || u.email || "";
          allUsersMap[u.uid].displayName = allUsersMap[u.uid].displayName || u.displayName || u.email || "";
        }
      });
      pageToken = page.pageToken;
    } while (pageToken);
  } catch (err) {
    console.warn("Could not fetch auth users for warehouse:", err.message);
  }

  return Object.keys(allUsersMap).map((uid) => {
    const data = allUsersMap[uid] || {};
    const access = data.access && typeof data.access === "object" ? data.access : data;
    const email = data.email || "";

    const isSuperAdmin = isAdminEmail(email);

    let isEnabled = false;
    if (isSuperAdmin) {
      isEnabled = true;
    } else if (
      data.warehouseEnabled === false ||
      access.warehouseEnabled === false ||
      data.warehouseRole === "disabled" ||
      access.warehouseRole === "disabled"
    ) {
      isEnabled = false;
    } else {
      isEnabled = Boolean(
        data.warehouseEnabled ??
        access.warehouseEnabled ??
        (data.warehouseRole && data.warehouseRole !== "disabled") ??
        (access.warehouseRole && access.warehouseRole !== "disabled")
      );
    }

    const warehouseRole = isSuperAdmin
      ? "admin"
      : (isEnabled ? (data.warehouseRole || access.warehouseRole || "warehouse_operator") : "disabled");

    const allowedProjects = Array.isArray(data.allowedProjects)
      ? data.allowedProjects
      : (Array.isArray(access.allowedProjects) ? access.allowedProjects : ["*"]);

    const canDelete = isSuperAdmin
      ? true
      : (typeof data.canDelete === "boolean" ? data.canDelete : (typeof access.canDelete === "boolean" ? access.canDelete : (warehouseRole !== "warehouse_viewer")));
    const canEdit = isSuperAdmin
      ? true
      : (typeof data.canEdit === "boolean" ? data.canEdit : (typeof access.canEdit === "boolean" ? access.canEdit : (warehouseRole !== "warehouse_viewer")));
    const canUpload = isSuperAdmin
      ? true
      : (typeof data.canUpload === "boolean" ? data.canUpload : (typeof access.canUpload === "boolean" ? access.canUpload : (warehouseRole !== "warehouse_viewer")));
    const canDispatch = isSuperAdmin
      ? true
      : (typeof data.canDispatch === "boolean" ? data.canDispatch : (typeof access.canDispatch === "boolean" ? access.canDispatch : (warehouseRole !== "warehouse_viewer")));
    const canManual = isSuperAdmin
      ? true
      : (typeof data.canManual === "boolean" ? data.canManual : (typeof access.canManual === "boolean" ? access.canManual : (warehouseRole !== "warehouse_viewer")));

    return {
      uid: uid,
      email: email,
      displayName: data.displayName || data.name || email || uid,
      role: access.role || data.role || "user",
      warehouseEnabled: isEnabled,
      warehouseRole,
      allowedProjects,
      canDelete,
      canEdit,
      canUpload,
      canDispatch,
      canManual,
    };
  });
}

/**
 * Update user warehouse permission (Admin Action)
 */
async function updateWarehouseUserAccess(targetUid, { warehouseEnabled, warehouseRole, allowedProjects, canDelete, canEdit, canUpload, canDispatch, canManual }, actorEmail) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");

  const userRef = db.collection("users").doc(targetUid);
  const userDoc = await userRef.get();

  let email = "";
  let displayName = "";
  if (userDoc.exists) {
    const d = userDoc.data() || {};
    email = d.email || "";
    displayName = d.displayName || d.name || "";
  }

  if (!email || !displayName) {
    try {
      const authUser = await admin.auth().getUser(targetUid);
      email = email || authUser.email || "";
      displayName = displayName || authUser.displayName || email || targetUid;
    } catch (e) {
      console.warn(`Could not get Auth user for ${targetUid}:`, e.message);
    }
  }

  const isSuperAdminTarget = isAdminEmail(email);

  const enabled = isSuperAdminTarget ? true : Boolean(warehouseEnabled);
  const role = isSuperAdminTarget ? "admin" : (enabled ? (warehouseRole || "warehouse_operator") : "disabled");
  const formattedProjects = isSuperAdminTarget ? ["*"] : (Array.isArray(allowedProjects) && allowedProjects.length > 0 ? allowedProjects : ["*"]);
  const boolDelete = isSuperAdminTarget ? true : (typeof canDelete === "boolean" ? canDelete : true);
  const boolEdit = isSuperAdminTarget ? true : (typeof canEdit === "boolean" ? canEdit : true);
  const boolUpload = isSuperAdminTarget ? true : (typeof canUpload === "boolean" ? canUpload : true);
  const boolDispatch = isSuperAdminTarget ? true : (typeof canDispatch === "boolean" ? canDispatch : true);
  const boolManual = isSuperAdminTarget ? true : (typeof canManual === "boolean" ? canManual : true);

  const updatePayload = {
    email,
    displayName,
    warehouseEnabled: enabled,
    warehouseRole: role,
    allowedProjects: formattedProjects,
    canDelete: boolDelete,
    canEdit: boolEdit,
    canUpload: boolUpload,
    canDispatch: boolDispatch,
    canManual: boolManual,
    warehouseAccessUpdatedAt: new Date().toISOString(),
    warehouseAccessUpdatedBy: actorEmail || "admin",
    updatedAt: new Date().toISOString(),
    "access.warehouseEnabled": enabled,
    "access.warehouseRole": role,
  };

  await userRef.set(updatePayload, { merge: true });

  return {
    uid: targetUid,
    warehouseEnabled: enabled,
    warehouseRole: role,
    allowedProjects: formattedProjects,
    canDelete: boolDelete,
    canEdit: boolEdit,
    canUpload: boolUpload,
    canDispatch: boolDispatch,
    canManual: boolManual
  };
}

/**
 * Helper to resolve project ID (handles legacy 'default_canex' mapping to real CANEX doc ID e.g. BJFieT4FRQeqGFcmMhvZ)
 */
async function resolveProjectId(db, projectId) {
  if (!db || !projectId) return projectId;

  if (projectId === "default_canex") {
    try {
      const defaultStockSnap = await db
        .collection("warehouseProjects")
        .doc("default_canex")
        .collection("stock")
        .limit(1)
        .get();

      if (!defaultStockSnap.empty) {
        return "default_canex";
      }

      const canexSnap = await db
        .collection("warehouseProjects")
        .where("code", "==", "CANEX")
        .limit(1)
        .get();

      if (!canexSnap.empty) {
        return canexSnap.docs[0].id;
      }
    } catch (e) {
      console.warn("Error resolving projectId for default_canex:", e.message);
    }
  }
  return projectId;
}

/**
 * List warehouse projects (creates default Canex Stock if empty)
 */
async function listProjects() {
  const db = getDb();
  if (!db) return [];

  const snapshot = await db.collection("warehouseProjects").get();
  let projects = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const defaultProjectData = {
    name: "Canex Stock",
    code: "CANEX",
    description: "المخزن الرئيسي لقطاعات وإكسسوارات كانكس",
    status: "active",
  };

  // Ensure default project exists ONLY if system has 0 projects in total
  if (projects.length === 0) {
    await db.collection("warehouseProjects").doc("default_canex").set(
      {
        ...defaultProjectData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    projects.push({ id: "default_canex", ...defaultProjectData });
  }

  // Deduplicate while PRESERVING actual doc.id
  const projectMap = new Map();
  projects.forEach((p) => {
    if (!projectMap.has(p.id)) {
      projectMap.set(p.id, {
        ...p,
        id: p.id,
        name: p.name || (p.code === "CANEX" ? "Canex Stock" : p.id),
      });
    }
  });

  return Array.from(projectMap.values());
}

/**
 * Create a new warehouse project
 */
async function createProject({ name, code, description }, actorUid) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");

  const projectData = {
    name: name.trim(),
    code: (code || name).trim().toUpperCase().replace(/\s+/g, "_"),
    description: (description || "").trim(),
    status: "active",
    createdBy: actorUid || "admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const ref = await db.collection("warehouseProjects").add(projectData);
  return { id: ref.id, ...projectData };
}

/**
 * Get current stock snapshot for a project (with cross-project aggregation fallback & movement invoice enrichment)
 */
async function getProjectStock(projectId) {
  const db = getDb();
  if (!db) return [];
  projectId = await resolveProjectId(db, projectId);

  const stockMap = new Map();

  const fetchStockFromProj = async (pid) => {
    try {
      const snapshot = await db.collection("warehouseProjects").doc(pid).collection("stock").get();
      snapshot.docs.forEach((doc) => {
        const itemKey = doc.id;
        const data = doc.data() || {};
        if (!stockMap.has(itemKey)) {
          stockMap.set(itemKey, { itemKey, ...data });
        } else {
          const existing = stockMap.get(itemKey);
          stockMap.set(itemKey, {
            ...existing,
            ...data,
            quantityBar: (Number(existing.quantityBar) || 0) + (Number(data.quantityBar) || 0),
            quantityLm: (Number(existing.quantityLm) || 0) + (Number(data.quantityLm) || 0),
            quantityKg: (Number(existing.quantityKg) || 0) + (Number(data.quantityKg) || 0),
          });
        }
      });
    } catch (e) {
      console.warn(`Error fetching stock for project ${pid}:`, e.message);
    }
  };

  await fetchStockFromProj(projectId);

  // Fetch deleted stock keys to prevent self-healing from resurrecting deleted stock items
  const deletedKeys = new Set();
  try {
    const deletedSnap = await db.collection("warehouseProjects").doc(projectId).collection("deletedStock").get();
    deletedSnap.docs.forEach((dDoc) => deletedKeys.add(dDoc.id));
  } catch (dErr) {
    console.warn(`Error fetching deletedStock for ${projectId}:`, dErr.message);
  }

  // Self-Healing & Enrichment from Movements History
  const itemInvoicesMap = new Map(); // key/code -> Set of invoice numbers
  const itemLatestInvoiceMap = new Map(); // key/code -> { invoiceNumber, createdAt }
  const mvtAggMap = new Map(); // key -> aggregated stock object calculated directly from movements

  const fetchMovementsForEnrichment = async (pid) => {
    try {
      const mvtsSnap = await db.collection("warehouseProjects").doc(pid).collection("movements").get();
      mvtsSnap.docs.forEach((mDoc) => {
        const mData = mDoc.data() || {};
        const invNo = mData.invoiceNumber;
        const itemCode = mData.itemCode || "";
        const supplier = mData.supplier || "CANEX";
        const finish = mData.finish || mData.color || "MF";
        const lengthMm = Number(mData.lengthMm || 6000);
        const itemKey = mData.itemKey || generateItemKey(supplier, itemCode, finish, lengthMm);

        if (!itemKey) return;

        // Build invoice tracking maps
        if (invNo && invNo !== "-" && invNo !== "—") {
          const keys = [itemKey, itemCode].filter(Boolean);
          keys.forEach((k) => {
            if (!itemInvoicesMap.has(k)) itemInvoicesMap.set(k, new Set());
            itemInvoicesMap.get(k).add(invNo);

            const existingLatest = itemLatestInvoiceMap.get(k);
            const mvtDate = mData.createdAt || 0;
            if (!existingLatest || new Date(mvtDate) > new Date(existingLatest.createdAt || 0)) {
              itemLatestInvoiceMap.set(k, {
                invoiceNumber: invNo,
                salesOrder: mData.salesOrder || "",
                customerReference: mData.customerReference || "",
                createdAt: mvtDate,
              });
            }
          });
        }

        // Build stock aggregation map from movements for self-healing
        if (!mvtAggMap.has(itemKey)) {
          mvtAggMap.set(itemKey, {
            itemKey,
            itemCode: itemCode || "CODE",
            customerCode: mData.customerCode || "",
            description: mData.description || "",
            finish,
            color: mData.color || finish,
            lengthMm,
            unit: mData.unit || "BAR",
            quantityBar: 0,
            quantityLm: 0,
            quantityKg: 0,
            lastUnitCost: Number(mData.unitPrice || 0),
            lastBarCost: Number(mData.barPrice || 0),
            priceUnit: mData.priceUnit || "M",
            currency: mData.currency || "EGP",
            lastInvoiceNumber: invNo || "—",
            lastSalesOrder: mData.salesOrder || "",
            lastCustomerRef: mData.customerReference || "",
            updatedAt: mData.createdAt || new Date().toISOString(),
          });
        }

        const aggItem = mvtAggMap.get(itemKey);
        const isOutbound = mData.movementType === "outbound";
        const qBar = Number(mData.quantityBar || 0);
        const qLm = Number(mData.quantityLm || 0);
        const qKg = Number(mData.quantityKg || 0);

        aggItem.quantityBar += isOutbound ? -qBar : qBar;
        aggItem.quantityLm += isOutbound ? -qLm : qLm;
        aggItem.quantityKg += isOutbound ? -qKg : qKg;
      });
    } catch (e) {
      console.warn(`Error fetching movements for enrichment in ${pid}:`, e.message);
    }
  };

  await fetchMovementsForEnrichment(projectId);

  // Self-Healing Step: Reconcile missing stock items from movements into stockMap & write back to Firestore
  let repairBatch = db.batch();
  let repairOps = 0;

  for (const [key, aggItem] of mvtAggMap.entries()) {
    if (deletedKeys.has(key)) {
      // Do not self-heal items that have been explicitly deleted by admin
      continue;
    }
    if (!stockMap.has(key)) {
      const invoicesSet = itemInvoicesMap.get(key) || new Set();
      const newStockDoc = {
        ...aggItem,
        invoiceNumbers: Array.from(invoicesSet),
      };
      stockMap.set(key, newStockDoc);

      try {
        const stockDocRef = db.collection("warehouseProjects").doc(projectId).collection("stock").doc(key);
        repairBatch.set(stockDocRef, newStockDoc, { merge: true });
        repairOps++;
      } catch (e) {
        console.warn(`Error queuing stock repair for ${key}:`, e.message);
      }
    }
  }

  if (repairOps > 0) {
    try {
      await repairBatch.commit();
      console.log(`[Self-Healing] Repaired and synced ${repairOps} stock items for project ${projectId}`);
    } catch (e) {
      console.warn(`[Self-Healing] Failed to commit stock repair batch for ${projectId}:`, e.message);
    }
  }

  // Attach enriched invoice numbers and metadata to stock items
  const finalStock = Array.from(stockMap.values())
    .filter((item) => !deletedKeys.has(item.itemKey))
    .map((item) => {
      const keyInvoices = itemInvoicesMap.get(item.itemKey) || itemInvoicesMap.get(item.itemCode) || new Set();
      const existingInvoices = new Set(Array.isArray(item.invoiceNumbers) ? item.invoiceNumbers : []);
      if (item.lastInvoiceNumber && item.lastInvoiceNumber !== "—" && item.lastInvoiceNumber !== "-") {
        existingInvoices.add(item.lastInvoiceNumber);
      }
      keyInvoices.forEach((inv) => existingInvoices.add(inv));

      const combinedInvoices = Array.from(existingInvoices).filter(Boolean);
      const latestFromMvts = itemLatestInvoiceMap.get(item.itemKey) || itemLatestInvoiceMap.get(item.itemCode);
      const lastInvoiceNumber = item.lastInvoiceNumber && item.lastInvoiceNumber !== "—" && item.lastInvoiceNumber !== "-"
        ? item.lastInvoiceNumber
        : (latestFromMvts ? latestFromMvts.invoiceNumber : (combinedInvoices[combinedInvoices.length - 1] || "—"));

      const lastSalesOrder = item.lastSalesOrder || (latestFromMvts ? latestFromMvts.salesOrder : "") || "—";
      const lastCustomerRef = item.lastCustomerRef || (latestFromMvts ? latestFromMvts.customerReference : "") || "—";

      return {
        ...item,
        invoiceNumbers: combinedInvoices,
        lastInvoiceNumber,
        lastSalesOrder,
        lastCustomerRef,
        salesOrder: lastSalesOrder,
        customerReference: lastCustomerRef,
      };
    });

  return finalStock;
}

/**
 * Helper to generate item key
 */
function generateItemKey(supplier, itemCode, finish, lengthMm) {
  const clean = (val) => String(val || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const p1 = clean(supplier) || "ITEM";
  const p2 = clean(itemCode) || "CODE";
  const p3 = clean(finish) || "RAW";
  const p4 = lengthMm ? String(lengthMm) : "STD";
  return `${p1}-${p2}-${p3}-${p4}`;
}

/**
 * Log an audit entry for warehouse actions
 */
async function logWarehouseAudit(projectId, { action, userUid, userEmail, userName, details, itemKey, invoiceId }) {
  const db = getDb();
  if (!db) return;
  projectId = await resolveProjectId(db, projectId);

  try {
    const auditRef = db.collection("warehouseProjects").doc(projectId).collection("auditLogs").doc();
    const logDoc = {
      id: auditRef.id,
      projectId,
      action, // 'PROCESS_INVOICE', 'EDIT_STOCK_ITEM', 'DELETE_STOCK_ITEM', 'UPDATE_INVOICE_META', 'DELETE_INVOICE'
      userUid: userUid || "system",
      userEmail: userEmail || "غير معروف",
      userName: userName || userEmail || "مستخدم",
      details: details || {},
      itemKey: itemKey || null,
      invoiceId: invoiceId || null,
      timestamp: new Date().toISOString(),
    };
    await auditRef.set(logDoc);
  } catch (err) {
    console.error("Failed to write warehouse audit log:", err.message);
  }
}

/**
 * Fetch audit activity logs for a project (Admin Only)
 */
async function getWarehouseAuditLogs(projectId, limit = 150) {
  const db = getDb();
  if (!db) return [];
  projectId = await resolveProjectId(db, projectId);

  try {
    const snap = await db
      .collection("warehouseProjects")
      .doc(projectId)
      .collection("auditLogs")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error("Error fetching warehouse audit logs:", err.message);
    return [];
  }
}

/**
 * Process reviewed purchase invoice lines into immutable movements and updated stock
 */
/**
 * Resolves the original inbound acquisition cost (bar price & meter price) for an item
 * from project stock or past inbound movements history.
 */
async function resolveItemInboundCost(projectRef, itemKey, itemCode, customerCode, lengthMm = 6000) {
  const clean = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/gi, "");
  const normItem = clean(itemCode);
  const normCust = clean(customerCode);

  // 1. Check stock document by exact itemKey
  if (itemKey) {
    try {
      const sDoc = await projectRef.collection("stock").doc(itemKey).get();
      if (sDoc.exists) {
        const s = sDoc.data() || {};
        const bCost = Number(s.lastBarCost || s.barPrice || 0);
        const uCost = Number(s.lastUnitCost || s.unitPrice || 0);
        if (bCost > 0 || uCost > 0) {
          return {
            barPrice: bCost || (lengthMm > 0 ? (uCost * lengthMm) / 1000 : 0),
            unitPrice: uCost || (lengthMm > 0 ? (bCost * 1000) / lengthMm : 0),
          };
        }
      }
    } catch (e) {}
  }

  // 2. Scan stock collection for matching itemCode or customerCode
  try {
    const sSnap = await projectRef.collection("stock").get();
    for (const doc of sSnap.docs) {
      const s = doc.data() || {};
      const sItem = clean(s.itemCode);
      const sCust = clean(s.customerCode);
      if ((normItem && (sItem === normItem || sCust === normItem)) || (normCust && (sItem === normCust || sCust === normCust))) {
        const bCost = Number(s.lastBarCost || s.barPrice || 0);
        const uCost = Number(s.lastUnitCost || s.unitPrice || 0);
        if (bCost > 0 || uCost > 0) {
          return {
            barPrice: bCost || (lengthMm > 0 ? (uCost * lengthMm) / 1000 : 0),
            unitPrice: uCost || (lengthMm > 0 ? (bCost * 1000) / lengthMm : 0),
          };
        }
      }
    }
  } catch (e) {}

  // 3. Scan movements for matching inbound movement
  try {
    const mSnap = await projectRef.collection("movements")
      .where("movementType", "==", "inbound")
      .limit(60)
      .get();
    for (const doc of mSnap.docs) {
      const m = doc.data() || {};
      const mItem = clean(m.itemCode);
      const mCust = clean(m.customerCode);
      if ((normItem && (mItem === normItem || mCust === normItem)) || (normCust && (mItem === normCust || mCust === normCust))) {
        const bCost = Number(m.barPrice || (m.quantityBar > 0 ? m.netTotal / m.quantityBar : 0));
        const uCost = Number(m.unitPrice || (m.quantityLm > 0 ? m.netTotal / m.quantityLm : 0));
        if (bCost > 0 || uCost > 0) {
          return {
            barPrice: bCost || (lengthMm > 0 ? (uCost * lengthMm) / 1000 : 0),
            unitPrice: uCost || (lengthMm > 0 ? (bCost * 1000) / lengthMm : 0),
          };
        }
      }
    }
  } catch (e) {}

  return { barPrice: 0, unitPrice: 0 };
}

function isCoatedItem(line) {
  if (!line) return false;
  const finish = String(line.finish || line.color || "").trim().toUpperCase();
  const desc = String(line.description || "").toUpperCase();

  if (/^(MF|MILL|RAW|خام|MILL\s*FINISH)$/i.test(finish)) {
    return false;
  }

  if (/RAL|ANODIZ|SD|POWDER|COAT|دهان|الوان/i.test(finish) || /RAL|ANODIZ|دهان/i.test(desc)) {
    return true;
  }

  if (finish && finish !== "MF" && finish !== "MILL" && finish !== "RAW") {
    return true;
  }

  return false;
}

/**
 * Fulfills/closes active Delmar dispatches when an outbound delivery invoice is dispatched from Delmar.
 */
async function fulfillDelmarDispatches(projectRef, invoiceDoc, lines, userUid, userEmail, userName) {
  try {
    const activeDispatchesSnap = await projectRef.collection("dispatches")
      .where("isCompleted", "==", false)
      .get();

    if (activeDispatchesSnap.empty) return 0;

    const clean = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/gi, "");
    const nowIso = new Date().toISOString();
    const invNumber = invoiceDoc.invoiceNumber || "—";
    const invCustomer = clean(invoiceDoc.customerReference || invoiceDoc.salesOrder || "");

    const delmarDispatches = [];
    for (const dDoc of activeDispatchesSnap.docs) {
      const d = dDoc.data() || {};
      const dSupplier = clean(d.coatingSupplier || "");
      const isDelmar = dSupplier.includes("delmar") || dSupplier.includes("دلمار") || d.dispatchType === "coating_then_customer";
      if (isDelmar && !d.isCompleted && d.currentStage !== "delivered_to_customer" && d.currentStage !== "closed") {
        delmarDispatches.push({ ref: dDoc.ref, id: dDoc.id, ...d });
      }
    }

    if (delmarDispatches.length === 0) return 0;

    // Calculate total bars to fulfill from Delmar
    let totalDelmarBarsInInvoice = 0;
    if (Array.isArray(lines) && lines.length > 0) {
      for (const l of lines) {
        if (l.delmarCovered) {
          const bars = l.delmarBars !== undefined && l.delmarBars !== null && l.delmarBars !== ""
            ? Number(l.delmarBars)
            : (l.delmarMode === "full" ? Number(l.quantityBar || l.bars || 0) : Number(l.delmarShortage || 0));
          totalDelmarBarsInInvoice += (isNaN(bars) ? 0 : bars);
        } else if (isCoatedItem(l)) {
          totalDelmarBarsInInvoice += Number(l.quantityBar || l.bars || 0);
        }
      }
    }
    if (totalDelmarBarsInInvoice === 0) {
      totalDelmarBarsInInvoice = Number(invoiceDoc.totalQuantityBar || invoiceDoc.totalBars || 0);
    }

    // Match priority: 1) Customer/SO match, 2) All active Delmar in project
    let candidateDispatches = delmarDispatches.filter(d => {
      const dCust = clean(d.customerName || "");
      const dProj = clean(d.projectNameOrSite || "");
      const dNote = clean(d.deliveryNote || "");
      return invCustomer && (dCust.includes(invCustomer) || invCustomer.includes(dCust) ||
                             dProj.includes(invCustomer) || invCustomer.includes(dProj) ||
                             dNote.includes(invCustomer) || invCustomer.includes(dNote));
    });

    if (candidateDispatches.length === 0) {
      candidateDispatches = delmarDispatches;
    }

    let closedCount = 0;
    let remainingBarsToFulfill = totalDelmarBarsInInvoice;

    for (const disp of candidateDispatches) {
      const dispTotalBars = Number(disp.totalQuantityBar || 0);
      const willFullyClose = remainingBarsToFulfill >= dispTotalBars || dispTotalBars === 0;

      const stageLabel = `المرحلة 2: تم تسليم القطاعات للعميل النهائي وإغلاق الدورة بموجب إذن الصرف (${invNumber})`;
      const stageNote = `تم تسليم ${willFullyClose ? dispTotalBars : remainingBarsToFulfill} عود للعميل النهائي بموجب إذن صرف رقم (${invNumber})`;

      await disp.ref.set(
        {
          currentStage: "delivered_to_customer",
          isCompleted: true,
          completedAt: nowIso,
          deliveryInvoiceNumber: invNumber,
          customerReceivedBy: invoiceDoc.customerReference || invoiceDoc.salesOrder || disp.customerName || "العميل النهائي",
          notes: (disp.notes ? disp.notes + " | " : "") + stageNote,
          stageHistory: admin.firestore.FieldValue.arrayUnion({
            stage: "delivered_to_customer",
            label: stageLabel,
            timestamp: nowIso,
            user: userName || userEmail || "النظام",
          }),
          updatedAt: nowIso,
          updatedBy: userUid || "system",
        },
        { merge: true }
      );

      closedCount++;
      remainingBarsToFulfill -= dispTotalBars;
      if (remainingBarsToFulfill <= 0) break;
    }

    return closedCount;
  } catch (err) {
    console.error("Error fulfilling Delmar dispatches:", err.message);
    return 0;
  }
}

async function processInboundInvoice(projectId, invoiceMeta, lines, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);

  const projectRef = db.collection("warehouseProjects").doc(projectId);

  const movementType = (invoiceMeta.movementType || "inbound").toLowerCase();
  const isOutbound = movementType === "outbound";
  const docType = isOutbound ? "sales_invoice" : "purchase_invoice";

  // Check if an invoice with the same invoiceNumber and movementType already exists
  const targetInvNo = String(invoiceMeta.invoiceNumber || "").trim();
  const forceSave = Boolean(invoiceMeta.forceSave || invoiceMeta.allowDuplicate);
  if (!forceSave && targetInvNo && targetInvNo !== "-" && targetInvNo !== "—" && !targetInvNo.startsWith("INV-")) {
    try {
      const existingSnap = await projectRef
        .collection("invoices")
        .where("invoiceNumber", "==", targetInvNo)
        .where("movementType", "==", isOutbound ? "outbound" : "inbound")
        .get();

      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data() || {};
        const existingId = existingDoc.id;

        const newSO = String(invoiceMeta.salesOrder || invoiceMeta.soNumber || "").trim();
        const newRef = String(invoiceMeta.customerReference || invoiceMeta.customerRef || "").trim();
        const newSupplier = String(invoiceMeta.supplier || "").trim();
        const newInvDate = String(invoiceMeta.invoiceDate || "").trim();

        const invUpdates = {};
        if (newSO && newSO !== existingData.salesOrder) invUpdates.salesOrder = newSO;
        if (newRef && newRef !== existingData.customerReference) invUpdates.customerReference = newRef;
        if (newSupplier && newSupplier !== existingData.supplier && newSupplier !== "Canex") invUpdates.supplier = newSupplier;
        if (newInvDate && newInvDate !== existingData.invoiceDate) invUpdates.invoiceDate = newInvDate;

        const hasUpdates = Object.keys(invUpdates).length > 0;

        if (hasUpdates) {
          invUpdates.updatedAt = new Date().toISOString();
          let dupBatch = db.batch();
          let dupOps = 0;

          dupBatch.update(existingDoc.ref, invUpdates);
          dupOps++;

          const mvtsSnap = await projectRef
            .collection("movements")
            .where("invoiceId", "==", existingId)
            .get();

          const mvtUpdates = {};
          if (invUpdates.salesOrder) mvtUpdates.salesOrder = invUpdates.salesOrder;
          if (invUpdates.customerReference) mvtUpdates.customerReference = invUpdates.customerReference;
          if (invUpdates.supplier) mvtUpdates.supplier = invUpdates.supplier;

          if (Object.keys(mvtUpdates).length > 0) {
            for (const mDoc of mvtsSnap.docs) {
              dupBatch.update(mDoc.ref, mvtUpdates);
              dupOps++;
              if (dupOps >= 400) {
                await dupBatch.commit();
                dupBatch = db.batch();
                dupOps = 0;
              }
            }
          }

          if (dupOps > 0) {
            await dupBatch.commit();
          }
        }

        return {
          success: true,
          isDuplicate: true,
          updatedMetadata: hasUpdates,
          invoiceId: existingId,
          message: hasUpdates
            ? `الفاتورة ${targetInvNo} مسجلة سابقاً. تم تحديث البيانات الناقصة (SO/Customer Ref) دون تكرار خصم أو إضافة الكميات.`
            : `الفاتورة ${targetInvNo} مسجلة مسبقاً في السجل بنفس البيانات. لم يتم مضاعفة الكميات في المخزن.`,
        };
      }
    } catch (err) {
      console.warn("Error checking for duplicate invoice:", err.message);
    }
  }

  // 1. Save Invoice Document
  const validLinesCount = lines.filter((l) => !l.ignored && !l.isService).length;
  const totalQtyBar = lines.reduce((acc, l) => acc + (l.ignored || l.isService ? 0 : Number(l.quantityBar || l.quantity || l.qtyBar || l.bars || 0)), 0);
  const totalQtyLm = lines.reduce((acc, l) => {
    if (l.ignored || l.isService) return acc;
    const qLm = Number(l.quantityLm || l.qtyLm || 0);
    if (qLm > 0) return acc + qLm;
    const qBar = Number(l.quantityBar || l.quantity || l.qtyBar || l.bars || 0);
    const lenMm = Number(l.lengthMm || l.length || 6000);
    return acc + (qBar * lenMm) / 1000;
  }, 0);

  const invoiceDoc = {
    invoiceNumber: invoiceMeta.invoiceNumber || `INV-${Date.now()}`,
    salesOrder: invoiceMeta.salesOrder || invoiceMeta.soNumber || "",
    customerReference: invoiceMeta.customerReference || invoiceMeta.customerRef || "",
    invoiceDate: invoiceMeta.invoiceDate || "",
    receiptDate: invoiceMeta.receiptDate || invoiceMeta.deliveryDate || "",
    supplier: invoiceMeta.supplier || "Canex",
    documentType: docType,
    movementType: isOutbound ? "outbound" : "inbound",
    currency: invoiceMeta.currency || "EGP",
    lineItemsCount: validLinesCount,
    totalQuantityBar: totalQtyBar,
    totalQuantityLm: totalQtyLm,
    totalAmount: Number(invoiceMeta.totalAmount || lines.reduce((sum, l) => sum + (l.ignored || l.isService ? 0 : Number(l.netTotal || 0)), 0)),
    fileName: invoiceMeta.fileName || "manual_upload",
    uploadedBy: userUid,
    status: "reviewed_and_saved",
    createdAt: new Date().toISOString(),
  };

  const invRef = await projectRef.collection("invoices").add(invoiceDoc);
  const invoiceId = invRef.id;

  let batch = db.batch();
  let opCount = 0;
  const createdMovements = [];
  let computedInvoiceTotal = 0;
  let totalDelmarDispatchedBars = 0;

  const commitBatchIfNeeded = async (force = false) => {
    if (opCount >= 400 || (force && opCount > 0)) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  // 1.5 Auto-Snapshot before applying invoice movements (Zero-Click Auto Restore Point)
  const autoTitle = isOutbound
    ? `[تلقائي] قبل معالجة فاتورة صرف رقم ${invoiceDoc.invoiceNumber || '—'}`
    : `[تلقائي] قبل معالجة فاتورة توريد رقم ${invoiceDoc.invoiceNumber || '—'}`;
  const autoDesc = `حفظ تلقائي قبل معالجة فاتورة ${isOutbound ? 'صرف' : 'توريد'} (${invoiceDoc.invoiceNumber || '—'}) - بواسطة: ${userName || userEmail || 'النظام'}`;
  await createAutoRestorePoint(projectId, autoTitle, autoDesc, userUid, userEmail, userName);

  // 2. Loop through lines
  for (const line of lines) {
    if (line.ignored || line.isService) continue;

    const supplier = line.supplier || invoiceMeta.supplier || "CANEX";
    const itemCode = line.itemCode || line.internalCode || "CODE";
    const customerCode = line.customerCode || "";
    const finish = line.finish || line.color || "STD";
    const lengthMm = Number(line.lengthMm || line.length || 6000);

    const itemKey = line.itemKey || generateItemKey(supplier, itemCode, finish, lengthMm);

    const qtyBar = Number(line.quantityBar || line.quantity || line.qtyBar || line.bars || 0);
    const qtyLm = Number(line.quantityLm || (qtyBar * lengthMm) / 1000);
    const qtyKg = Number(line.quantityKg || line.weightKg || 0);
    let unitPrice = Number(line.unitPrice || 0);
    let barPrice = Number(line.barPrice || 0);
    let priceUnit = line.priceUnit || (unitPrice ? "M" : "BAR");
    let netTotal = Number(line.netTotal || (qtyBar > 0 && barPrice > 0 ? qtyBar * barPrice : qtyBar * unitPrice));

    // If outbound and unit/bar price or netTotal is missing (like in Schüco SD delivery notes), look up inbound cost!
    if (isOutbound && (netTotal === 0 || (unitPrice === 0 && barPrice === 0))) {
      const resolvedCost = await resolveItemInboundCost(projectRef, itemKey, itemCode, customerCode, lengthMm);
      if (resolvedCost.barPrice > 0 || resolvedCost.unitPrice > 0) {
        barPrice = resolvedCost.barPrice;
        unitPrice = resolvedCost.unitPrice;
        priceUnit = barPrice > 0 ? "BAR" : "M";
        netTotal = qtyBar > 0 && barPrice > 0 ? (qtyBar * barPrice) : (qtyLm * unitPrice);
      }
    }
    computedInvoiceTotal += netTotal;

    // Factors for stock balance updates (+ for inbound, - for outbound)
    let actualDeductBar = qtyBar;
    let actualDeductLm = qtyLm;
    let actualDeductKg = qtyKg;

    if (isOutbound && line.delmarCovered) {
      if (line.delmarBars !== undefined && line.delmarBars !== null && line.delmarBars !== '') {
        // User explicitly specified the exact number of bars from Delmar
        const dBars = Math.min(qtyBar, Math.max(0, Number(line.delmarBars)));
        actualDeductBar = Math.max(0, qtyBar - dBars);
        actualDeductLm = (actualDeductBar * lengthMm) / 1000;
        actualDeductKg = qtyBar > 0 ? (actualDeductBar / qtyBar) * qtyKg : 0;
      } else if (line.delmarMode === 'full') {
        // Dispatched 100% from Delmar stock, main warehouse is untouched!
        actualDeductBar = 0;
        actualDeductLm = 0;
        actualDeductKg = 0;
      } else {
        // Shortage covered from Delmar, only deduct available warehouse portion
        const shortage = Number(line.delmarShortage || 0);
        actualDeductBar = Math.max(0, qtyBar - shortage);
        actualDeductLm = (actualDeductBar * lengthMm) / 1000;
        actualDeductKg = qtyBar > 0 ? (actualDeductBar / qtyBar) * qtyKg : 0;
      }
    }

    const factorBar = isOutbound ? -actualDeductBar : qtyBar;
    const factorLm = isOutbound ? -actualDeductLm : qtyLm;
    const factorKg = isOutbound ? -actualDeductKg : qtyKg;

    // Create Movement
    const mvtRef = projectRef.collection("movements").doc();
    const movementData = {
      invoiceId,
      invoiceNumber: invoiceDoc.invoiceNumber,
      salesOrder: invoiceDoc.salesOrder,
      customerReference: invoiceDoc.customerReference,
      movementType: isOutbound ? "outbound" : "inbound",
      delmarCovered: Boolean(line.delmarCovered),
      delmarMode: line.delmarMode || null,
      delmarDispatchedBars: (() => {
        const dbars = isOutbound && line.delmarCovered ? (line.delmarBars !== undefined && line.delmarBars !== null && line.delmarBars !== "" ? Math.min(qtyBar, Math.max(0, Number(line.delmarBars))) : (line.delmarMode === "full" ? qtyBar : Number(line.delmarShortage || 0))) : 0;
        totalDelmarDispatchedBars += dbars;
        return dbars;
      })(),
      _legacyDelmarCheck: isOutbound && line.delmarCovered
        ? (line.delmarBars !== undefined && line.delmarBars !== null && line.delmarBars !== ''
            ? Math.min(qtyBar, Math.max(0, Number(line.delmarBars)))
            : (line.delmarMode === 'full' ? qtyBar : Number(line.delmarShortage || 0)))
        : 0,
      itemKey,
      itemCode,
      customerCode,
      description: line.description || "Glazing Bead / Profile",
      finish,
      lengthMm,
      unit: line.unit || "BAR",
      quantityBar: qtyBar,
      quantityLm: qtyLm,
      quantityKg: qtyKg,
      unitPrice,
      barPrice,
      priceUnit,
      netTotal,
      currency: invoiceDoc.currency,
      createdBy: userUid,
      createdAt: new Date().toISOString(),
    };
    batch.set(mvtRef, movementData);
    createdMovements.push({ id: mvtRef.id, ...movementData });
    opCount++;

    // Update Item Master
    const itemRef = projectRef.collection("items").doc(itemKey);
    batch.set(
      itemRef,
      {
        itemKey,
        itemCode,
        customerCode,
        description: line.description || "",
        finish,
        color: line.color || finish,
        lengthMm,
        unit: line.unit || "BAR",
        secondaryUnit: "LM",
        priceUnit,
        barPrice,
        weightKg: qtyKg,
        temper: line.temper || "",
        alloy: line.alloy || "",
        hsCode: line.hsCode || "",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    opCount++;

    // If item was previously marked deleted, remove from deletedStock to resurrect with new invoice payload
    try {
      const deletedRef = projectRef.collection("deletedStock").doc(itemKey);
      batch.delete(deletedRef);
      opCount++;
    } catch (dErr) { }

    // Update Stock Snapshot
    const stockRef = projectRef.collection("stock").doc(itemKey);
    batch.set(
      stockRef,
      {
        itemKey,
        itemCode,
        customerCode,
        description: line.description || "",
        finish,
        color: line.color || finish,
        lengthMm,
        unit: line.unit || "BAR",
        quantityBar: admin.firestore.FieldValue.increment(factorBar),
        quantityLm: admin.firestore.FieldValue.increment(factorLm),
        quantityKg: admin.firestore.FieldValue.increment(factorKg),
        lastUnitCost: unitPrice,
        lastBarCost: barPrice,
        priceUnit,
        currency: invoiceDoc.currency,
        lastInvoiceNumber: invoiceDoc.invoiceNumber,
        lastSalesOrder: invoiceDoc.salesOrder || "",
        lastCustomerRef: invoiceDoc.customerReference || "",
        lastMovementType: invoiceDoc.movementType,
        invoiceNumbers: admin.firestore.FieldValue.arrayUnion(invoiceDoc.invoiceNumber),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    opCount++;

    await commitBatchIfNeeded(false);
  }

  await commitBatchIfNeeded(true);

  // If Outbound delivery invoice, fulfill matching active Delmar dispatches
  if (isOutbound) {
    try {
      await fulfillDelmarDispatches(projectRef, invoiceDoc, lines, userUid, userEmail, userName);
    } catch (fulfillErr) {
      console.error("[processInboundInvoice] Error fulfilling Delmar dispatches:", fulfillErr.message);
    }
  }

  await logWarehouseAudit(projectId, {
    action: "PROCESS_INVOICE",
    userUid,
    userEmail,
    userName,
    invoiceId,
    details: {
      invoiceNumber: invoiceDoc.invoiceNumber,
      movementType: isOutbound ? "خصم (Outbound)" : "إضافة (Inbound)",
      supplier: invoiceDoc.supplier,
      salesOrder: invoiceDoc.salesOrder,
      customerReference: invoiceDoc.customerReference,
      lineItemsCount: validLinesCount,
      totalQuantityBar: totalQtyBar,
      totalAmount: invoiceDoc.totalAmount,
      fileName: invoiceDoc.fileName,
    },
  });

  return {
    success: true,
    invoiceId,
    movementType: isOutbound ? "outbound" : "inbound",
    movementsCount: createdMovements.length,
  };
}

/**
 * Get transaction invoice history for a project (with cross-project aggregation fallback)
 */
async function getProjectInvoices(projectId) {
  const db = getDb();
  if (!db) return [];
  projectId = await resolveProjectId(db, projectId);

  const invoiceMap = new Map();

  const fetchInvoicesFromProj = async (pid) => {
    try {
      const snapshot = await db
        .collection("warehouseProjects")
        .doc(pid)
        .collection("invoices")
        .get();

      for (const doc of snapshot.docs) {
        if (invoiceMap.has(doc.id)) continue;
        const data = doc.data() || {};
        let lineItemsCount = Number(data.lineItemsCount || data.movementsCount || 0);
        let totalQuantityBar = Number(data.totalQuantityBar || data.totalBars || 0);
        let totalQuantityLm = Number(data.totalQuantityLm || data.totalLm || 0);

        if (!lineItemsCount || !totalQuantityBar) {
          let mvtsSnapshot = await db
            .collection("warehouseProjects")
            .doc(pid)
            .collection("movements")
            .where("invoiceId", "==", doc.id)
            .get();

          if (mvtsSnapshot.empty && data.invoiceNumber) {
            mvtsSnapshot = await db
              .collection("warehouseProjects")
              .doc(pid)
              .collection("movements")
              .where("invoiceNumber", "==", data.invoiceNumber)
              .get();
          }

          if (!mvtsSnapshot.empty) {
            lineItemsCount = mvtsSnapshot.size;
            totalQuantityBar = 0;
            totalQuantityLm = 0;
            mvtsSnapshot.forEach((mDoc) => {
              const mData = mDoc.data() || {};
              totalQuantityBar += Number(mData.quantityBar || mData.quantity || mData.qtyBar || 0);
              totalQuantityLm += Number(mData.quantityLm || mData.qtyLm || 0);
            });
          }
        }

        invoiceMap.set(doc.id, {
          id: doc.id,
          ...data,
          lineItemsCount,
          totalQuantityBar,
          totalQuantityLm,
        });
      }
    } catch (e) {
      console.warn(`Error fetching invoices for project ${pid}:`, e.message);
    }
  };

  await fetchInvoicesFromProj(projectId);

  // Return invoices scoped strictly to current project

  const result = Array.from(invoiceMap.values());
  result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return result;
}

/**
 * Get item movement log for a project or specific invoice (with cross-project fallback)
 */
async function getProjectMovements(projectId, invoiceId) {
  const db = getDb();
  if (!db) return [];
  projectId = await resolveProjectId(db, projectId);

  const mvtMap = new Map();

  const fetchMovementsFromProj = async (pid) => {
    try {
      let query = db.collection("warehouseProjects").doc(pid).collection("movements");
      if (invoiceId) {
        query = query.where("invoiceId", "==", invoiceId);
      }
      const snapshot = await query.get();
      snapshot.docs.forEach((doc) => {
        if (!mvtMap.has(doc.id)) {
          mvtMap.set(doc.id, { id: doc.id, ...doc.data() });
        }
      });
    } catch (e) {
      console.warn(`Error fetching project movements for ${pid}:`, e.message);
    }
  };

  await fetchMovementsFromProj(projectId);

  // Return movements scoped strictly to current project

  return Array.from(mvtMap.values());
}

/**
 * Update a specific stock item in a project (Admin Only)
 */
async function updateStockItem(projectId, itemKey, updateData, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);

  const stockRef = db.collection("warehouseProjects").doc(projectId).collection("stock").doc(itemKey);
  const doc = await stockRef.get();
  if (!doc.exists) throw new Error("Stock item not found in warehouse.");

  const existing = doc.data() || {};
  const lengthMm = Number(updateData.lengthMm !== undefined ? updateData.lengthMm : (existing.lengthMm || 6000));
  const qtyBar = Number(updateData.quantityBar !== undefined ? updateData.quantityBar : (existing.quantityBar || 0));
  const qtyLm = Number(updateData.quantityLm !== undefined ? updateData.quantityLm : ((qtyBar * lengthMm) / 1000));
  const qtyKg = Number(updateData.quantityKg !== undefined ? updateData.quantityKg : (existing.quantityKg || 0));

  const newSalesOrder = updateData.lastSalesOrder !== undefined
    ? updateData.lastSalesOrder
    : (updateData.salesOrder !== undefined ? updateData.salesOrder : (existing.lastSalesOrder || existing.salesOrder || ""));

  const newCustomerRef = updateData.lastCustomerRef !== undefined
    ? updateData.lastCustomerRef
    : (updateData.customerReference !== undefined ? updateData.customerReference : (existing.lastCustomerRef || existing.customerReference || ""));

  const payload = {
    itemCode: updateData.itemCode !== undefined ? updateData.itemCode : existing.itemCode,
    customerCode: updateData.customerCode !== undefined ? updateData.customerCode : (existing.customerCode || ""),
    description: updateData.description !== undefined ? updateData.description : existing.description,
    finish: updateData.finish !== undefined ? updateData.finish : existing.finish,
    lengthMm,
    quantityBar: qtyBar,
    quantityLm: qtyLm,
    quantityKg: qtyKg,
    lastSalesOrder: newSalesOrder,
    lastCustomerRef: newCustomerRef,
    lastUnitCost: updateData.lastUnitCost !== undefined ? Number(updateData.lastUnitCost) : existing.lastUnitCost,
    updatedBy: userUid,
    updatedAt: new Date().toISOString(),
  };

  await stockRef.set(payload, { merge: true });

  await logWarehouseAudit(projectId, {
    action: "EDIT_STOCK_ITEM",
    userUid,
    userEmail,
    userName,
    itemKey,
    details: {
      itemCode: payload.itemCode,
      description: payload.description,
      quantityBar: { old: existing.quantityBar || 0, new: payload.quantityBar },
      salesOrder: { old: existing.lastSalesOrder || existing.salesOrder || "", new: newSalesOrder },
      customerRef: { old: existing.lastCustomerRef || existing.customerReference || "", new: newCustomerRef },
      finish: payload.finish,
      customerCode: payload.customerCode,
    },
  });

  return { itemKey, ...existing, ...payload };
}

/**
 * Delete a specific stock item from a project (Admin Only)
 */
async function deleteStockItem(projectId, itemKey, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);

  const stockRef = db.collection("warehouseProjects").doc(projectId).collection("stock").doc(itemKey);
  const doc = await stockRef.get();
  const existing = doc.exists ? doc.data() : {};

  // 1. Delete stock document from Firestore
  await stockRef.delete();

  // 2. Persist deleted status in deletedStock collection to block self-healing restoration
  try {
    await db
      .collection("warehouseProjects")
      .doc(projectId)
      .collection("deletedStock")
      .doc(itemKey)
      .set({
        itemKey,
        deletedAt: new Date().toISOString(),
        deletedBy: userUid || "admin",
        itemCode: existing.itemCode || "",
      });
  } catch (delErr) {
    console.warn(`[DeleteStockItem] Error writing deletedStock entry for ${itemKey}:`, delErr.message);
  }

  // 3. Mark movements as isDeleted for this itemKey so history is preserved if restored later
  try {
    const mvtsSnap = await db
      .collection("warehouseProjects")
      .doc(projectId)
      .collection("movements")
      .where("itemKey", "==", itemKey)
      .get();

    if (!mvtsSnap.empty) {
      let batch = db.batch();
      let ops = 0;
      for (const mDoc of mvtsSnap.docs) {
        batch.update(mDoc.ref, { isDeleted: true });
        ops++;
        if (ops >= 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
      if (ops > 0) {
        await batch.commit();
      }
      console.log(`[DeleteStockItem] Soft-deleted ${mvtsSnap.size} movement records for itemKey ${itemKey}`);
    }
  } catch (mvtErr) {
    console.warn(`[DeleteStockItem] Error soft-deleting movements for ${itemKey}:`, mvtErr.message);
  }

  // 4. Log Audit Trail
  await logWarehouseAudit(projectId, {
    action: "DELETE_STOCK_ITEM",
    userUid,
    userEmail,
    userName,
    itemKey,
    details: {
      itemCode: existing.itemCode || itemKey,
      description: existing.description || "",
      quantityBar: existing.quantityBar || 0,
    },
  });

  return { itemKey, deleted: true };
}

/**
 * Get movement history for a specific stock item across all invoices and projects
 */
async function getItemMovementsHistory(projectId, itemKey, itemCode) {
  const db = getDb();
  if (!db) return [];
  projectId = await resolveProjectId(db, projectId);

  const mvtMap = new Map();

  const fetchItemMovementsFromProj = async (pid) => {
    try {
      let snap = await db
        .collection("warehouseProjects")
        .doc(pid)
        .collection("movements")
        .where("itemKey", "==", itemKey)
        .get();

      if (snap.empty && itemCode) {
        snap = await db
          .collection("warehouseProjects")
          .doc(pid)
          .collection("movements")
          .where("itemCode", "==", itemCode)
          .get();
      }

      snap.docs.forEach((doc) => {
        if (!mvtMap.has(doc.id)) {
          mvtMap.set(doc.id, { id: doc.id, ...doc.data() });
        }
      });
    } catch (e) {
      console.warn(`Error fetching movements for project ${pid}:`, e.message);
    }
  };

  await fetchItemMovementsFromProj(projectId);

  // Return item movements scoped strictly to current project

  let movements = Array.from(mvtMap.values()).filter((m) => !m.isDeleted);

  // Synthetic initial movement fallback if movements history is empty but stock item exists with balance > 0
  if (movements.length === 0) {
    try {
      const stockDoc = await db.collection("warehouseProjects").doc(projectId).collection("stock").doc(itemKey).get();
      if (stockDoc.exists) {
        const sData = stockDoc.data() || {};
        const qBar = Number(sData.quantityBar || 0);
        if (qBar > 0) {
          const synthMvt = {
            id: `initial-snapshot-${itemKey}`,
            movementType: "inbound",
            invoiceNumber: sData.lastInvoiceNumber || "رصيد دفتري/أصل المخزون",
            salesOrder: sData.lastSalesOrder || sData.salesOrder || "—",
            customerReference: sData.lastCustomerRef || sData.customerReference || "—",
            description: sData.description || "رصيد المخزون المسجل والمستعاد بنجاح",
            finish: sData.finish || "STD",
            lengthMm: Number(sData.lengthMm || 6000),
            quantityBar: qBar,
            quantityLm: Number(sData.quantityLm || (qBar * (sData.lengthMm || 6000)) / 1000),
            quantityKg: Number(sData.quantityKg || 0),
            unitPrice: Number(sData.lastUnitCost || 0),
            createdAt: sData.updatedAt || new Date().toISOString(),
            runningBar: qBar,
            runningLm: Number(sData.quantityLm || (qBar * (sData.lengthMm || 6000)) / 1000),
            isInitialSnapshot: true,
          };
          return [synthMvt];
        }
      }
    } catch (sErr) {
      console.warn(`[getItemMovementsHistory] Error creating fallback movement for ${itemKey}:`, sErr.message);
    }
  }

  // Sort chronologically ascending to calculate running stock balance
  movements.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  let runningBar = 0;
  let runningLm = 0;

  const movementsWithBalance = movements.map((m) => {
    const isOutbound = m.movementType === "outbound";
    const barQty = Number(m.quantityBar || m.quantity || 0);
    const lmQty = Number(m.quantityLm || 0);

    if (isOutbound) {
      runningBar -= barQty;
      runningLm -= lmQty;
    } else {
      runningBar += barQty;
      runningLm += lmQty;
    }

    return {
      ...m,
      runningBar,
      runningLm: Number(runningLm.toFixed(2)),
    };
  });

  // Reverse to show newest transactions at top
  return movementsWithBalance.reverse();
}

/**
 * Update invoice metadata (Sales Order & Customer Reference) and sync to movements
 */
async function updateInvoiceMetadata(projectId, invoiceId, { salesOrder, customerReference }, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);

  const invoiceRef = db.collection("warehouseProjects").doc(projectId).collection("invoices").doc(invoiceId);
  const invDoc = await invoiceRef.get();
  if (!invDoc.exists) throw new Error("Invoice not found.");

  const existingData = invDoc.data() || {};
  const newSO = String(salesOrder || "").trim();
  const newRef = String(customerReference || "").trim();

  const payload = {
    salesOrder: newSO,
    customerReference: newRef,
    updatedAt: new Date().toISOString(),
  };

  await invoiceRef.set(payload, { merge: true });

  // Batch update all associated movements
  const movementsSnap = await db
    .collection("warehouseProjects")
    .doc(projectId)
    .collection("movements")
    .where("invoiceId", "==", invoiceId)
    .get();

  if (!movementsSnap.empty) {
    const batch = db.batch();
    movementsSnap.docs.forEach((doc) => {
      batch.update(doc.ref, payload);
    });
    await batch.commit();
  }

  await logWarehouseAudit(projectId, {
    action: "UPDATE_INVOICE_META",
    userUid,
    userEmail,
    userName,
    invoiceId,
    details: {
      invoiceNumber: existingData.invoiceNumber || "",
      salesOrder: { old: existingData.salesOrder || "", new: newSO },
      customerReference: { old: existingData.customerReference || "", new: newRef },
    },
  });

  return { invoiceId, ...payload };
}

/**
 * Create a new Restore Point (Snapshot) for a project
 */
async function createProjectRestorePoint(projectId, { name, description, isAuto } = {}, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);

  const stockSnap = await db
    .collection("warehouseProjects")
    .doc(projectId)
    .collection("stock")
    .get();

  const stockItems = [];
  let totalQuantityBar = 0;
  let totalQuantityLm = 0;
  let totalQuantityKg = 0;

  stockSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const item = { itemKey: doc.id, ...data };
    stockItems.push(item);
    totalQuantityBar += Number(data.quantityBar || 0);
    totalQuantityLm += Number(data.quantityLm || 0);
    totalQuantityKg += Number(data.quantityKg || 0);
  });

  // Snapshot movements history as well
  let movementsSnapshot = [];
  try {
    const mvtsSnap = await db
      .collection("warehouseProjects")
      .doc(projectId)
      .collection("movements")
      .get();
    movementsSnapshot = mvtsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (mErr) {
    console.warn(`[CreateRestorePoint] Warning capturing movements for ${projectId}:`, mErr.message);
  }

  // Snapshot invoices history as well
  let invoicesSnapshot = [];
  try {
    const invsSnap = await db
      .collection("warehouseProjects")
      .doc(projectId)
      .collection("invoices")
      .get();
    invoicesSnapshot = invsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (iErr) {
    console.warn(`[CreateRestorePoint] Warning capturing invoices for ${projectId}:`, iErr.message);
  }

  // Snapshot dispatches history as well
  let dispatchesSnapshot = [];
  try {
    const dispSnap = await db
      .collection("warehouseProjects")
      .doc(projectId)
      .collection("dispatches")
      .get();
    dispatchesSnapshot = dispSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (dErr) {
    console.warn(`[CreateRestorePoint] Warning capturing dispatches for ${projectId}:`, dErr.message);
  }

  const pointName = String(name || "").trim() || `نقطة حفظ تلقائية - ${new Date().toLocaleDateString("ar-EG")}`;
  const pointDesc = String(description || "").trim();

  const restorePointData = {
    name: pointName,
    description: pointDesc,
    isAuto: Boolean(isAuto),
    totalItems: stockItems.length,
    totalQuantityBar,
    totalQuantityLm: Number(totalQuantityLm.toFixed(2)),
    totalQuantityKg: Number(totalQuantityKg.toFixed(2)),
    createdBy: userUid || "admin",
    createdByEmail: userEmail || "",
    createdByName: userName || "",
    createdAt: new Date().toISOString(),
    stockSnapshot: stockItems,
    movementsSnapshot,
    invoicesSnapshot,
    dispatchesSnapshot,
  };

  const pointRef = await db
    .collection("warehouseProjects")
    .doc(projectId)
    .collection("restorePoints")
    .add(restorePointData);

  await logWarehouseAudit(projectId, {
    action: "CREATE_RESTORE_POINT",
    userUid,
    userEmail,
    userName,
    details: {
      pointId: pointRef.id,
      name: pointName,
      description: pointDesc,
      isAuto: Boolean(isAuto),
      totalItems: stockItems.length,
      totalQuantityBar,
    },
  });

  const { stockSnapshot, ...summaryData } = restorePointData;
  return { id: pointRef.id, ...summaryData };
}

/**
 * Create an automatic Restore Point (Snapshot) before critical stock mutations
 */
async function createAutoRestorePoint(projectId, actionTitle, actionDescription, userUid, userEmail, userName) {
  try {
    const db = getDb();
    if (!db) return null;

    const res = await createProjectRestorePoint(
      projectId,
      {
        name: actionTitle,
        description: actionDescription,
        isAuto: true,
      },
      userUid,
      userEmail,
      userName
    );

    // Prune older auto restore points beyond the latest 30 to prevent excessive storage
    try {
      const resolvedProjId = await resolveProjectId(db, projectId);
      const allPointsSnap = await db
        .collection("warehouseProjects")
        .doc(resolvedProjId)
        .collection("restorePoints")
        .orderBy("createdAt", "desc")
        .get();

      const autoDocs = allPointsSnap.docs.filter((d) => d.data()?.isAuto === true);
      if (autoDocs.length > 30) {
        const toDelete = autoDocs.slice(30);
        let delBatch = db.batch();
        let delCount = 0;
        for (const doc of toDelete) {
          delBatch.delete(doc.ref);
          delCount++;
          if (delCount % 400 === 0) {
            await delBatch.commit();
            delBatch = db.batch();
          }
        }
        if (delCount % 400 !== 0) {
          await delBatch.commit();
        }
      }
    } catch (pruneErr) {
      console.warn("[createAutoRestorePoint] Prune warning:", pruneErr.message);
    }

    return res;
  } catch (err) {
    console.warn("[createAutoRestorePoint] Auto-snapshot skipped on error:", err.message);
    return null;
  }
}

/**
 * Rollback / Undo an Invoice transaction and reverse stock movements (Admin Only)
 */
async function rollbackInvoiceTransaction(projectId, invoiceId, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);
  const projectRef = db.collection("warehouseProjects").doc(projectId);

  // 1. Fetch Invoice
  const invRef = projectRef.collection("invoices").doc(invoiceId);
  const invDoc = await invRef.get();
  if (!invDoc.exists) {
    throw new Error("الفاتورة غير موجودة أو تم حذفها مسبقاً.");
  }

  const invData = invDoc.data() || {};
  if (invData.isCancelled || invData.status === "cancelled") {
    throw new Error("تم إلغاء هذه الفاتورة والتراجع عن حركاتها مسبقاً.");
  }

  // 2. Fetch associated movements
  let mvtsSnap = await projectRef
    .collection("movements")
    .where("invoiceId", "==", invoiceId)
    .get();

  if (mvtsSnap.empty && invData.invoiceNumber) {
    mvtsSnap = await projectRef
      .collection("movements")
      .where("invoiceNumber", "==", invData.invoiceNumber)
      .get();
  }

  const isOutbound = (invData.movementType || "").toLowerCase() === "outbound";
  const nowIso = new Date().toISOString();

  // 3. Take an auto restore point before doing the rollback (Safety Net)
  await createAutoRestorePoint(
    projectId,
    `[تلقائي] قبل التراجع عن فاتورة ${invData.invoiceNumber || invoiceId}`,
    `حفظ تلقائي قبل التراجع عن الفاتورة وعكس أرصدتها بواسطة ${userName || userEmail || 'SuperAdmin'}`,
    userUid,
    userEmail,
    userName
  );

  let batch = db.batch();
  let opCount = 0;

  const commitBatchIfNeeded = async (force = false) => {
    if (opCount >= 400 || (force && opCount > 0)) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  // 4. Reverse Stock quantities for each movement item
  const reversedItems = [];
  for (const mDoc of mvtsSnap.docs) {
    const mData = mDoc.data() || {};
    if (mData.isDeleted) continue;

    const itemKey = mData.itemKey;
    const qtyBar = Number(mData.quantityBar || mData.quantity || 0);
    const qtyLm = Number(mData.quantityLm || 0);
    const qtyKg = Number(mData.quantityKg || 0);

    // If original was Inbound (+), we subtract (-).
    // If Outbound (-), only add back what was ACTUALLY deducted from warehouse (exclude Delmar portion)!
    const delmarBars = Number(mData.delmarDispatchedBars || 0);
    const actualWhDeductBar = isOutbound ? Math.max(0, qtyBar - delmarBars) : qtyBar;
    const actualWhDeductLm = isOutbound && qtyBar > 0 ? (actualWhDeductBar / qtyBar) * qtyLm : qtyLm;
    const actualWhDeductKg = isOutbound && qtyBar > 0 ? (actualWhDeductBar / qtyBar) * qtyKg : qtyKg;

    const reverseFactorBar = isOutbound ? actualWhDeductBar : -qtyBar;
    const reverseFactorLm = isOutbound ? actualWhDeductLm : -qtyLm;
    const reverseFactorKg = isOutbound ? actualWhDeductKg : -qtyKg;

    if (itemKey && (reverseFactorBar !== 0 || reverseFactorLm !== 0)) {
      const stockRef = projectRef.collection("stock").doc(itemKey);
      batch.set(
        stockRef,
        {
          quantityBar: admin.firestore.FieldValue.increment(reverseFactorBar),
          quantityLm: admin.firestore.FieldValue.increment(reverseFactorLm),
          quantityKg: admin.firestore.FieldValue.increment(reverseFactorKg),
          invoiceNumbers: admin.firestore.FieldValue.arrayRemove(invData.invoiceNumber),
          updatedAt: nowIso,
        },
        { merge: true }
      );
      opCount++;
      await commitBatchIfNeeded(false);
    }

    // Mark movement as cancelled & soft-deleted
    batch.update(mDoc.ref, {
      isDeleted: true,
      isCancelled: true,
      cancelledAt: nowIso,
      cancelledBy: userUid || "admin",
      cancelledByName: userName || userEmail || "",
    });
    opCount++;
    await commitBatchIfNeeded(false);

    reversedItems.push({
      itemKey,
      itemCode: mData.itemCode,
      qtyBar,
      reversal: isOutbound ? `+${qtyBar} BAR (إعادة للمخزن)` : `-${qtyBar} BAR (خصم من المخزن)`,
    });
  }

  // 5. If there's an associated dispatch, mark it cancelled
  if (invData.dispatchId) {
    try {
      const dRef = projectRef.collection("dispatches").doc(invData.dispatchId);
      batch.update(dRef, {
        currentStage: "cancelled",
        isCancelled: true,
        cancelledAt: nowIso,
        notes: `تم إلغاء الإذن وعكس حركة الصرف بواسطة ${userName || userEmail}`,
      });
      opCount++;
      await commitBatchIfNeeded(false);
    } catch (dErr) {
      console.warn("[rollbackInvoiceTransaction] Dispatch cancel warning:", dErr.message);
    }
  }

  // Reopen any Delmar dispatches that were delivered or fulfilled by this rolled-back delivery note
  if (isOutbound) {
    const invNumber = invData.invoiceNumber || "";
    try {
      const dispSnap = await projectRef.collection("dispatches").get();
      for (const dDoc of dispSnap.docs) {
        const d = dDoc.data() || {};
        const dNotes = String(d.notes || "");
        const dSupplier = String(d.coatingSupplier || "").toLowerCase();
        const dCustomer = String(d.customerName || "").toLowerCase();
        const invCustomer = String(invData.customerReference || invData.salesOrder || "").toLowerCase();

        const isDelmar = dSupplier.includes("delmar") || dSupplier.includes("دلمار");
        const matchesDeliv = invNumber && dNotes.includes(invNumber);
        const matchesCustomer = invCustomer && (dCustomer.includes(invCustomer) || invCustomer.includes(dCustomer));

        if (isDelmar && (matchesDeliv || matchesCustomer)) {
          batch.update(dDoc.ref, {
            currentStage: "in_coating",
            isCompleted: false,
            completedAt: null,
            notes: dNotes.replace(new RegExp(`.*?${invNumber}.*?`, "g"), "").trim() || "تم التراجع عن إذن الصرف وإعادة فتح الأمر لقيد الدهان",
            updatedAt: nowIso,
          });
          opCount++;
          await commitBatchIfNeeded(false);
        }
      }
    } catch (dReopenErr) {
      console.warn("[rollbackInvoiceTransaction] Error reopening Delmar dispatches:", dReopenErr.message);
    }
  }

  // 6. Mark Invoice document as cancelled
  batch.update(invRef, {
    status: "cancelled",
    isCancelled: true,
    cancelledAt: nowIso,
    cancelledBy: userUid || "admin",
    cancelledByName: userName || userEmail || "",
    updatedAt: nowIso,
  });
  opCount++;

  await commitBatchIfNeeded(true);

  // 7. Audit Log
  await logWarehouseAudit(projectId, {
    action: "ROLLBACK_INVOICE",
    userUid,
    userEmail,
    userName,
    invoiceId,
    details: {
      invoiceNumber: invData.invoiceNumber,
      movementType: invData.movementType,
      reversedItemsCount: reversedItems.length,
      reversedItems,
      actionNote: isOutbound
        ? "تم إلغاء إذن/فاتورة الصرف وإعادة الكميات المسحوبة لرصيد المخزن بنجاح"
        : "تم إلغاء فاتورة التوريد وخصم الكميات الموردة من رصيد المخزن بنجاح",
    },
  });

  return {
    success: true,
    invoiceId,
    invoiceNumber: invData.invoiceNumber,
    reversedItemsCount: reversedItems.length,
    movementType: invData.movementType,
  };
}

/**
 * List all Restore Points for a project
 */
async function listProjectRestorePoints(projectId) {
  const db = getDb();
  if (!db) return [];
  projectId = await resolveProjectId(db, projectId);

  const snap = await db
    .collection("warehouseProjects")
    .doc(projectId)
    .collection("restorePoints")
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data() || {};
    const { stockSnapshot, ...summary } = data;
    return { id: doc.id, isAuto: Boolean(data.isAuto), ...summary };
  });
}

/**
 * Restore a project to a specific Restore Point
 */
async function restoreProjectToPoint(projectId, pointId, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);

  const pointRef = db
    .collection("warehouseProjects")
    .doc(projectId)
    .collection("restorePoints")
    .doc(pointId);

  const pointDoc = await pointRef.get();
  if (!pointDoc.exists) throw new Error("Restore point not found.");

  const pointData = pointDoc.data() || {};
  const stockSnapshot = Array.isArray(pointData.stockSnapshot) ? pointData.stockSnapshot : [];

  // 1. Clear deletedStock records so restored items are not blocked from appearing
  try {
    const deletedStockSnap = await db
      .collection("warehouseProjects")
      .doc(projectId)
      .collection("deletedStock")
      .get();

    if (!deletedStockSnap.empty) {
      let delBatch = db.batch();
      let delCount = 0;
      const delBatches = [];
      deletedStockSnap.docs.forEach((doc) => {
        delBatch.delete(doc.ref);
        delCount++;
        if (delCount % 400 === 0) {
          delBatches.push(delBatch.commit());
          delBatch = db.batch();
        }
      });
      if (delCount % 400 !== 0) {
        delBatches.push(delBatch.commit());
      }
      await Promise.all(delBatches);
    }
  } catch (dErr) {
    console.warn(`[RestoreToPoint] Error clearing deletedStock for ${projectId}:`, dErr.message);
  }

  // 2. Delete current stock items in batches
  const currentStockSnap = await db
    .collection("warehouseProjects")
    .doc(projectId)
    .collection("stock")
    .get();

  if (!currentStockSnap.empty) {
    const deleteBatches = [];
    let currentBatch = db.batch();
    let count = 0;

    for (const doc of currentStockSnap.docs) {
      currentBatch.delete(doc.ref);
      count++;
      if (count % 400 === 0) {
        deleteBatches.push(currentBatch.commit());
        currentBatch = db.batch();
      }
    }
    if (count % 400 !== 0) {
      deleteBatches.push(currentBatch.commit());
    }
    await Promise.all(deleteBatches);
  }

  // 3. Write snapshot stock items in batches
  if (stockSnapshot.length > 0) {
    const setBatches = [];
    let setBatch = db.batch();
    let setCount = 0;

    for (const item of stockSnapshot) {
      const itemKey = item.itemKey;
      if (!itemKey) continue;
      const itemRef = db
        .collection("warehouseProjects")
        .doc(projectId)
        .collection("stock")
        .doc(itemKey);

      const { itemKey: _, ...itemData } = item;
      setBatch.set(itemRef, { itemKey, ...itemData });
      setCount++;
      if (setCount % 400 === 0) {
        setBatches.push(setBatch.commit());
        setBatch = db.batch();
      }
    }
    if (setCount % 400 !== 0) {
      setBatches.push(setBatch.commit());
    }
    await Promise.all(setBatches);
  }

  // 4. Restore movementsSnapshot if present in pointData
  const movementsSnapshot = Array.isArray(pointData.movementsSnapshot) ? pointData.movementsSnapshot : [];
  if (movementsSnapshot.length > 0) {
    try {
      const currentMvtsSnap = await db
        .collection("warehouseProjects")
        .doc(projectId)
        .collection("movements")
        .get();

      if (!currentMvtsSnap.empty) {
        let mvtDelBatch = db.batch();
        let mvtDelCount = 0;
        const mvtDelBatches = [];
        for (const mDoc of currentMvtsSnap.docs) {
          mvtDelBatch.delete(mDoc.ref);
          mvtDelCount++;
          if (mvtDelCount % 400 === 0) {
            mvtDelBatches.push(mvtDelBatch.commit());
            mvtDelBatch = db.batch();
          }
        }
        if (mvtDelCount % 400 !== 0) {
          mvtDelBatches.push(mvtDelBatch.commit());
        }
        await Promise.all(mvtDelBatches);
      }

      let mvtSetBatch = db.batch();
      let mvtSetCount = 0;
      const mvtSetBatches = [];
      for (const mvt of movementsSnapshot) {
        const { id: mvtId, ...mvtData } = mvt;
        const targetDocId = mvtId || db.collection("warehouseProjects").doc(projectId).collection("movements").doc().id;
        const mvtRef = db
          .collection("warehouseProjects")
          .doc(projectId)
          .collection("movements")
          .doc(targetDocId);

        mvtSetBatch.set(mvtRef, { ...mvtData, isDeleted: false });
        mvtSetCount++;
        if (mvtSetCount % 400 === 0) {
          mvtSetBatches.push(mvtSetBatch.commit());
          mvtSetBatch = db.batch();
        }
      }
      if (mvtSetCount % 400 !== 0) {
        mvtSetBatches.push(mvtSetBatch.commit());
      }
      await Promise.all(mvtSetBatches);
    } catch (mvtRestoreErr) {
      console.warn(`[RestoreToPoint] Error restoring movements for ${projectId}:`, mvtRestoreErr.message);
    }
  }

  // 5. Restore Invoices Snapshot or clean invoices added after this restore point
  const invoicesSnapshot = Array.isArray(pointData.invoicesSnapshot) ? pointData.invoicesSnapshot : [];
  try {
    const currentInvsSnap = await db
      .collection("warehouseProjects")
      .doc(projectId)
      .collection("invoices")
      .get();

    if (invoicesSnapshot.length > 0) {
      // Full exact restore of invoices
      for (const iDoc of currentInvsSnap.docs) {
        await iDoc.ref.delete();
      }
      for (const inv of invoicesSnapshot) {
        const { id, ...iData } = inv;
        await db.collection("warehouseProjects").doc(projectId).collection("invoices").doc(id).set(iData);
      }
    } else {
      // Legacy point: Remove any invoice that did not exist in movementsSnapshot
      const validInvNums = new Set(movementsSnapshot.map(m => m.invoiceNumber).filter(Boolean));
      const validInvIds = new Set(movementsSnapshot.map(m => m.invoiceId).filter(Boolean));

      for (const iDoc of currentInvsSnap.docs) {
        const inv = iDoc.data() || {};
        if (!validInvNums.has(inv.invoiceNumber) && !validInvIds.has(iDoc.id)) {
          await iDoc.ref.delete();
        }
      }
    }
  } catch (invRestoreErr) {
    console.warn(`[RestoreToPoint] Error restoring invoices for ${projectId}:`, invRestoreErr.message);
  }

  // 6. Restore Dispatches Snapshot or Revert Dispatches to in_coating if their delivery note was rolled back
  const dispatchesSnapshot = Array.isArray(pointData.dispatchesSnapshot) ? pointData.dispatchesSnapshot : [];
  try {
    const currentDispSnap = await db
      .collection("warehouseProjects")
      .doc(projectId)
      .collection("dispatches")
      .get();

    if (dispatchesSnapshot.length > 0) {
      // Full exact restore of dispatches
      for (const dDoc of currentDispSnap.docs) {
        await dDoc.ref.delete();
      }
      for (const disp of dispatchesSnapshot) {
        const { id, ...dData } = disp;
        await db.collection("warehouseProjects").doc(projectId).collection("dispatches").doc(id).set(dData);
      }
    } else {
      // Legacy point: Check if active outbound deliveries exist for Delmar. If not, reopen to in_coating!
      const validInvNums = new Set(movementsSnapshot.map(m => m.invoiceNumber).filter(Boolean));
      for (const dDoc of currentDispSnap.docs) {
        const d = dDoc.data() || {};
        const dNotes = String(d.notes || "");
        // If it was marked completed/delivered, reopen it back to in_coating!
        if (d.isCompleted || d.currentStage === "delivered_to_customer" || d.currentStage === "closed") {
          await dDoc.ref.update({
            currentStage: "in_coating",
            isCompleted: false,
            completedAt: null,
            notes: "تمت الاستعادة لنقطة حفظ سابقة وإعادة فتح الأمر لقيد الدهان والمعالجة",
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (dispRestoreErr) {
    console.warn(`[RestoreToPoint] Error restoring dispatches for ${projectId}:`, dispRestoreErr.message);
  }

  await logWarehouseAudit(projectId, {
    action: "RESTORE_PROJECT_POINT",
    userUid,
    userEmail,
    userName,
    details: {
      pointId,
      pointName: pointData.name || "",
      restoredItemsCount: stockSnapshot.length,
    },
  });

  return {
    success: true,
    pointId,
    pointName: pointData.name,
    restoredItemsCount: stockSnapshot.length,
  };
}

/**
 * Delete a Restore Point
 */
async function deleteProjectRestorePoint(projectId, pointId, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);

  const pointRef = db
    .collection("warehouseProjects")
    .doc(projectId)
    .collection("restorePoints")
    .doc(pointId);

  const pointDoc = await pointRef.get();
  const existingName = pointDoc.exists ? pointDoc.data().name : "";

  await pointRef.delete();

  await logWarehouseAudit(projectId, {
    action: "DELETE_RESTORE_POINT",
    userUid,
    userEmail,
    userName,
    details: {
      pointId,
      pointName: existingName,
    },
  });

  return { success: true, pointId };
}

/**
 * Delete a warehouse project and its subcollections (Admin only)
 */
async function deleteProject(projectId, actorUid) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");

  const resolvedId = await resolveProjectId(db, projectId);

  const projRef = db.collection("warehouseProjects").doc(resolvedId);
  const projSnap = await projRef.get();

  if (!projSnap.exists) {
    throw new Error("Project not found");
  }

  const projData = projSnap.data() || {};

  const allProjectsSnap = await db.collection("warehouseProjects").get();
  if (allProjectsSnap.docs.length <= 1) {
    throw new Error("لا يمكن حذف المشروع الوحيد المتبقي في النظام.");
  }

  const deleteCollection = async (collectionRef, batchSize = 100) => {
    const query = collectionRef.limit(batchSize);
    return new Promise((resolve, reject) => {
      deleteQueryBatch(db, query, resolve, reject);
    });
  };

  const deleteQueryBatch = (dbInstance, query, resolve, reject) => {
    query.get()
      .then((snapshot) => {
        if (snapshot.size === 0) return 0;
        const batch = dbInstance.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        return batch.commit().then(() => snapshot.size);
      })
      .then((numDeleted) => {
        if (numDeleted === 0) {
          resolve();
          return;
        }
        process.nextTick(() => deleteQueryBatch(dbInstance, query, resolve, reject));
      })
      .catch(reject);
  };

  try {
    await deleteCollection(projRef.collection("stock"));
    await deleteCollection(projRef.collection("invoices"));
    await deleteCollection(projRef.collection("movements"));
    await deleteCollection(projRef.collection("restorePoints"));
    await deleteCollection(projRef.collection("auditLogs"));
  } catch (err) {
    console.warn("Warning deleting project subcollections:", err);
  }

  await projRef.delete();

  // Also clean up any legacy or duplicate document matching default_canex ID or code
  if (projectId === "default_canex" || resolvedId === "default_canex") {
    try {
      await db.collection("warehouseProjects").doc("default_canex").delete();
    } catch (e) { }
  }
  if (projData.code) {
    try {
      const codeDups = await db.collection("warehouseProjects").where("code", "==", projData.code).get();
      for (const dDoc of codeDups.docs) {
        await dDoc.ref.delete();
      }
    } catch (e) { }
  }

  return { success: true, message: `تم حذف المشروع ${projData.name || resolvedId} بنجاح` };
}

/**
 * Process manual stock movement (Inbound or Outbound with Multi-Stage Dispatches)
 */
async function processManualStockMovement(projectId, { movementType, lines, meta, dispatchDetails }, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);

  const projectRef = db.collection("warehouseProjects").doc(projectId);
  const isOutbound = (movementType || "").toLowerCase() === "outbound";
  const nowIso = new Date().toISOString();

  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    throw new Error("يجب تحديد بند واحد على الأقل للحركة اليدوية.");
  }

  let batch = db.batch();
  let opCount = 0;
  const createdMovements = [];

  const commitBatchIfNeeded = async (force = false) => {
    if (opCount >= 400 || (force && opCount > 0)) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  // Generate a unique dispatch ID if outbound and dispatch stage is configured
  let dispatchId = null;
  let dispatchNumber = null;
  const isCoatingStage = isOutbound && (dispatchDetails?.dispatchType === "coating_then_customer" || dispatchDetails?.dispatchType === "coating_only");
  const initialStage = isCoatingStage ? "in_coating" : "delivered_to_customer";

  if (isOutbound && dispatchDetails) {
    const dRef = projectRef.collection("dispatches").doc();
    dispatchId = dRef.id;
    const yearMonth = new Date().getFullYear();
    dispatchNumber = dispatchDetails.deliveryNote || `DSP-${yearMonth}-${Math.floor(1000 + Math.random() * 9000)}`;

    const totalBars = lines.reduce((sum, l) => sum + Number(l.quantityBar || l.bars || 0), 0);
    const totalLm = lines.reduce((sum, l) => {
      const qLm = Number(l.quantityLm || 0);
      if (qLm > 0) return sum + qLm;
      const qBar = Number(l.quantityBar || l.bars || 0);
      const lenMm = Number(l.lengthMm || 6000);
      return sum + (qBar * lenMm) / 1000;
    }, 0);
    const totalKg = lines.reduce((sum, l) => sum + Number(l.quantityKg || l.weightKg || 0), 0);

    const dispatchDoc = {
      id: dispatchId,
      dispatchNumber,
      deliveryNote: dispatchDetails.deliveryNote || dispatchNumber,
      dispatchType: dispatchDetails.dispatchType || (isCoatingStage ? "coating_then_customer" : "direct_customer"),
      currentStage: initialStage,
      coatingSupplier: dispatchDetails.coatingSupplier || "ورشة / مورد الدهان",
      targetFinish: dispatchDetails.targetFinish || "تشطيب خاص",
      customerName: dispatchDetails.customerName || "العميل النهائي",
      projectNameOrSite: dispatchDetails.projectNameOrSite || dispatchDetails.destination || "الموقع العام",
      notes: dispatchDetails.notes || "",
      items: lines.map(l => ({
        itemKey: l.itemKey || generateItemKey(l.supplier || "CANEX", l.itemCode, l.finish || "STD", l.lengthMm || 6000),
        itemCode: l.itemCode || "CODE",
        customerCode: l.customerCode || "",
        description: l.description || "",
        finish: l.finish || "STD",
        lengthMm: Number(l.lengthMm || 6000),
        quantityBar: Number(l.quantityBar || l.bars || 0),
        quantityLm: Number(l.quantityLm || (Number(l.quantityBar || 0) * Number(l.lengthMm || 6000)) / 1000),
        quantityKg: Number(l.quantityKg || 0),
        unitPrice: Number(l.unitPrice || 0),
      })),
      totalQuantityBar: totalBars,
      totalQuantityLm: Number(totalLm.toFixed(2)),
      totalQuantityKg: Number(totalKg.toFixed(2)),
      dispatchedAt: dispatchDetails.dispatchDate || nowIso,
      dispatchedBy: userUid || "admin",
      dispatchedByEmail: userEmail || "",
      dispatchedByName: userName || userEmail || "مستخدم",
      stageHistory: [
        {
          stage: initialStage,
          label: isCoatingStage ? `تم الصرف والإرسال لمورد الدهان (${dispatchDetails.coatingSupplier || "المورد"})` : `تم الصرف والتسليم للعميل النهائي (${dispatchDetails.customerName || "العميل"})`,
          timestamp: nowIso,
          user: userName || userEmail || "مستخدم",
          notes: dispatchDetails.notes || (isCoatingStage ? `اللون المطلوب: ${dispatchDetails.targetFinish || "—"}` : "تسليم مباشر"),
        }
      ],
      isCompleted: !isCoatingStage,
      completedAt: !isCoatingStage ? nowIso : null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    batch.set(dRef, dispatchDoc);
    opCount++;
  }

  // Auto-Snapshot before manual movement
  const docRef = meta?.docNumber || dispatchNumber || (isOutbound ? "إذن صرف يدوي" : "إذن توريد يدوي");
  const autoTitle = isOutbound
    ? `[تلقائي] قبل حركة صرف يدوي (${docRef})`
    : `[تلقائي] قبل حركة توريد يدوي (${docRef})`;
  const autoDesc = `حفظ تلقائي قبل حركة ${isOutbound ? 'صرف' : 'توريد'} يدوي (${lines.length} بند) - بواسطة: ${userName || userEmail || 'النظام'}`;
  await createAutoRestorePoint(projectId, autoTitle, autoDesc, userUid, userEmail, userName);

  // Create an invoice record for the manual movement so it appears in history & can be rolled back
  const manualInvoiceRef = projectRef.collection("invoices").doc();
  const manualInvoiceId = manualInvoiceRef.id;
  const docNo = meta?.docNumber || dispatchNumber || (isOutbound ? `MAN-OUT-${Date.now()}` : `MAN-IN-${Date.now()}`);

  const totalBarsManual = lines.reduce((acc, l) => acc + Number(l.quantityBar || l.quantity || l.bars || 0), 0);
  const totalLmManual = lines.reduce((acc, l) => {
    const qLm = Number(l.quantityLm || 0);
    if (qLm > 0) return acc + qLm;
    const qBar = Number(l.quantityBar || l.quantity || l.bars || 0);
    const lenMm = Number(l.lengthMm || 6000);
    return acc + (qBar * lenMm) / 1000;
  }, 0);
  const totalKgManual = lines.reduce((acc, l) => acc + Number(l.quantityKg || l.weightKg || 0), 0);
  const totalAmountManual = lines.reduce((acc, l) => acc + Number(l.netTotal || (Number(l.quantityBar || 0) * Number(l.unitPrice || 0))), 0);

  const manualInvoiceDoc = {
    id: manualInvoiceId,
    invoiceNumber: docNo,
    movementType: isOutbound ? "outbound" : "inbound",
    salesOrder: meta?.salesOrder || (dispatchDetails?.customerName ? `طلب: ${dispatchDetails.customerName}` : "يدوي"),
    customerReference: meta?.customerReference || (dispatchDetails?.projectNameOrSite ? `موقع: ${dispatchDetails.projectNameOrSite}` : "إذن يدوي"),
    supplier: isOutbound ? (dispatchDetails?.coatingSupplier || "صرف خارجي") : (meta?.supplier || "توريد يدوي"),
    fileName: isOutbound ? "إذن صرف يدوي" : "إذن توريد يدوي",
    sourceType: "manual",
    lineItemsCount: lines.length,
    totalQuantityBar: totalBarsManual,
    totalQuantityLm: Number(totalLmManual.toFixed(2)),
    totalQuantityKg: Number(totalKgManual.toFixed(2)),
    totalAmount: totalAmountManual,
    currency: meta?.currency || "EGP",
    dispatchId: dispatchId || null,
    dispatchNumber: dispatchNumber || null,
    status: "active",
    createdBy: userUid || "admin",
    createdByName: userName || userEmail || "",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  batch.set(manualInvoiceRef, manualInvoiceDoc);
  opCount++;

  for (const line of lines) {
    const supplier = line.supplier || meta?.supplier || "CANEX";
    const itemCode = line.itemCode || line.internalCode || "CODE";
    const customerCode = line.customerCode || "";
    const finish = line.finish || line.color || "STD";
    const lengthMm = Number(line.lengthMm || line.length || 6000);
    const itemKey = line.itemKey || generateItemKey(supplier, itemCode, finish, lengthMm);

    const qtyBar = Number(line.quantityBar || line.quantity || line.bars || 0);
    const qtyLm = Number(line.quantityLm || (qtyBar * lengthMm) / 1000);
    const qtyKg = Number(line.quantityKg || line.weightKg || 0);
    const unitPrice = Number(line.unitPrice || 0);
    const netTotal = Number(line.netTotal || qtyBar * unitPrice);

    const factorBar = isOutbound ? -qtyBar : qtyBar;
    const factorLm = isOutbound ? -qtyLm : qtyLm;
    const factorKg = isOutbound ? -qtyKg : qtyKg;

    // Movement entry
    const mvtRef = projectRef.collection("movements").doc();
    const movementData = {
      sourceType: "manual",
      invoiceId: manualInvoiceId,
      movementType: isOutbound ? "outbound" : "inbound",
      invoiceNumber: docNo,
      salesOrder: meta?.salesOrder || line.salesOrder || (dispatchDetails?.customerName ? `طلب: ${dispatchDetails.customerName}` : "يدوي"),
      customerReference: meta?.customerReference || line.customerReference || (dispatchDetails?.projectNameOrSite ? `موقع: ${dispatchDetails.projectNameOrSite}` : "إذن يدوي"),
      supplier: isOutbound ? (dispatchDetails?.coatingSupplier || "العميل النهائي") : (supplier || "توريد يدوي"),
      dispatchId: dispatchId || null,
      dispatchStage: isOutbound ? initialStage : "inbound_stock",
      itemKey,
      itemCode,
      customerCode,
      description: line.description || "قطاع ألومنيوم",
      finish,
      lengthMm,
      unit: line.unit || "BAR",
      quantityBar: qtyBar,
      quantityLm: Number(qtyLm.toFixed(2)),
      quantityKg: Number(qtyKg.toFixed(2)),
      unitPrice,
      netTotal,
      currency: meta?.currency || "EGP",
      notes: meta?.notes || dispatchDetails?.notes || (isOutbound ? "صرف يدوي للقطاعات" : "توريد يدوي للقطاعات"),
      createdBy: userUid || "admin",
      createdAt: nowIso,
    };

    batch.set(mvtRef, movementData);
    createdMovements.push({ id: mvtRef.id, ...movementData });
    opCount++;

    // Update Stock Snapshot
    const stockRef = projectRef.collection("stock").doc(itemKey);
    const stockUpdatePayload = {
      itemKey,
      itemCode,
      customerCode,
      description: line.description || "قطاع ألومنيوم",
      finish,
      color: line.color || finish,
      lengthMm,
      unit: line.unit || "BAR",
      quantityBar: admin.firestore.FieldValue.increment(factorBar),
      quantityLm: admin.firestore.FieldValue.increment(factorLm),
      quantityKg: admin.firestore.FieldValue.increment(factorKg),
      lastMovementType: isOutbound ? "outbound" : "inbound",
      lastInvoiceNumber: docNo,
      lastSalesOrder: movementData.salesOrder,
      lastCustomerRef: movementData.customerReference,
      updatedAt: nowIso,
    };

    if (!isOutbound && unitPrice > 0) {
      stockUpdatePayload.lastUnitCost = unitPrice;
    }

    batch.set(stockRef, stockUpdatePayload, { merge: true });
    opCount++;

    // Ensure item master
    const itemRef = projectRef.collection("items").doc(itemKey);
    batch.set(itemRef, {
      itemKey,
      itemCode,
      customerCode,
      description: line.description || "",
      finish,
      color: line.color || finish,
      lengthMm,
      unit: line.unit || "BAR",
      secondaryUnit: "LM",
      updatedAt: nowIso,
    }, { merge: true });
    opCount++;

    await commitBatchIfNeeded(false);
  }

  await commitBatchIfNeeded(true);

  await logWarehouseAudit(projectId, {
    action: isOutbound ? "MANUAL_OUTBOUND_DISPATCH" : "MANUAL_INBOUND_SUPPLY",
    userUid,
    userEmail,
    userName,
    details: {
      movementType: isOutbound ? "صرف يدوي بمراحل" : "توريد يدوي",
      docNumber: meta?.docNumber || dispatchNumber,
      dispatchId,
      dispatchStage: initialStage,
      itemsCount: lines.length,
      totalQuantityBar: lines.reduce((acc, l) => acc + Number(l.quantityBar || 0), 0),
      coatingSupplier: dispatchDetails?.coatingSupplier || null,
      customerName: dispatchDetails?.customerName || null,
    }
  });

  return {
    success: true,
    movementType: isOutbound ? "outbound" : "inbound",
    dispatchId,
    dispatchNumber,
    currentStage: initialStage,
    itemsCount: lines.length,
    movementsCount: createdMovements.length,
  };
}

/**
 * Fetch all dispatches and lifecycle stages for a project
 */
async function getProjectDispatches(projectId, statusFilter = "all") {
  const db = getDb();
  if (!db) return [];
  projectId = await resolveProjectId(db, projectId);

  try {
    let query = db.collection("warehouseProjects").doc(projectId).collection("dispatches");
    const snap = await query.orderBy("dispatchedAt", "desc").get();
    let dispatches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Auto-integrity verification:
    // If no active outbound invoices exist for this project, all Delmar dispatches must be in_coating!
    const invSnap = await db.collection("warehouseProjects").doc(projectId).collection("invoices")
      .where("movementType", "==", "outbound")
      .get();
    const activeOutboundInvoices = invSnap.docs
      .map(doc => doc.data())
      .filter(inv => !inv.isCancelled && inv.status !== "cancelled");

    if (activeOutboundInvoices.length === 0) {
      for (const d of dispatches) {
        if (d.isCompleted || d.currentStage === "delivered_to_customer") {
          d.currentStage = "in_coating";
          d.isCompleted = false;
          d.completedAt = null;
          // Persist update in Firestore
          db.collection("warehouseProjects").doc(projectId).collection("dispatches").doc(d.id).update({
            currentStage: "in_coating",
            isCompleted: false,
            completedAt: null,
          }).catch(() => {});
        }
      }
    } else {
      // Auto-integrity verification: If active Delmar dispatches exist and matching outbound invoices exist, auto-fulfill them!
      const hasActiveDelmar = dispatches.some(
        (d) => !d.isCompleted && d.currentStage !== "delivered_to_customer" && (String(d.coatingSupplier || "").toLowerCase().includes("delmar") || String(d.coatingSupplier || "").includes("دلمار"))
      );
      if (hasActiveDelmar) {
        const projectRef = db.collection("warehouseProjects").doc(projectId);
        let anyClosed = false;
        for (const inv of activeOutboundInvoices) {
          const isDelmarInv = Boolean(inv.delmarAllocated) ||
            String(inv.coatingSupplier || "").toLowerCase().includes("delmar") ||
            String(inv.coatingSupplier || "").includes("دلمار") ||
            (inv.invoiceNumber && inv.invoiceNumber.startsWith("SD-"));
          if (isDelmarInv) {
            const closed = await fulfillDelmarDispatches(projectRef, inv, null, "system", "auto@fawterx.com", "فحص النزاهة التلقائي");
            if (closed > 0) anyClosed = true;
          }
        }
        if (anyClosed) {
          const updatedSnap = await query.orderBy("dispatchedAt", "desc").get();
          dispatches = updatedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      }
    }

    if (statusFilter === "active" || statusFilter === "in_progress") {
      dispatches = dispatches.filter(d => !d.isCompleted && d.currentStage !== "closed");
    } else if (statusFilter === "completed" || statusFilter === "closed") {
      dispatches = dispatches.filter(d => d.isCompleted || d.currentStage === "closed" || d.currentStage === "delivered_to_customer");
    }

    return dispatches;
  } catch (err) {
    console.error(`Error fetching dispatches for ${projectId}:`, err.message);
    return [];
  }
}

/**
 * Transition a dispatch to the next stage or mark completed
 */
async function updateDispatchStage(projectId, dispatchId, { stage, notes, completionDate, customerReceivedBy }, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);

  const dispatchRef = db.collection("warehouseProjects").doc(projectId).collection("dispatches").doc(dispatchId);
  const dDoc = await dispatchRef.get();
  if (!dDoc.exists) throw new Error("سجل أمر الصرف والتتبع غير موجود.");

  const currentData = dDoc.data() || {};
  const nowIso = new Date().toISOString();
  const targetStage = stage || "delivered_to_customer";
  const isNowCompleted = targetStage === "delivered_to_customer" || targetStage === "closed";

  const stageLabelMap = {
    in_coating: "المرحلة 1: قيد الدهان والمعالجة لدى المورد",
    ready_from_coating: "تم استلام القطاعات من الدهان وجاهزة للتسليم",
    delivered_to_customer: "المرحلة 2: تم التسليم للعميل النهائي وإغلاق العملية",
    closed: "مكتمل ومغلق نهائياً",
  };

  const newHistoryEntry = {
    stage: targetStage,
    label: stageLabelMap[targetStage] || targetStage,
    timestamp: completionDate || nowIso,
    user: userName || userEmail || "مستخدم",
    notes: notes || (targetStage === "delivered_to_customer" ? `تم التسليم للعميل النهائي (${currentData.customerName || "العميل"})${customerReceivedBy ? ` - المستلم: ${customerReceivedBy}` : ""}` : "تحديث المرحلة"),
  };

  const updatePayload = {
    currentStage: targetStage,
    isCompleted: isNowCompleted,
    completedAt: isNowCompleted ? (completionDate || nowIso) : null,
    customerReceivedBy: customerReceivedBy || currentData.customerReceivedBy || "",
    stageHistory: admin.firestore.FieldValue.arrayUnion(newHistoryEntry),
    updatedAt: nowIso,
    updatedBy: userUid || "admin",
  };

  await dispatchRef.set(updatePayload, { merge: true });

  await logWarehouseAudit(projectId, {
    action: "UPDATE_DISPATCH_STAGE",
    userUid,
    userEmail,
    userName,
    details: {
      dispatchId,
      dispatchNumber: currentData.dispatchNumber,
      previousStage: currentData.currentStage,
      newStage: targetStage,
      isCompleted: isNowCompleted,
      notes,
    },
  });

  return {
    success: true,
    dispatchId,
    currentStage: targetStage,
    isCompleted: isNowCompleted,
  };
}

/**
 * Delete a dispatch record (Admin only)
 */
async function deleteProjectDispatch(projectId, dispatchId, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);

  const dispatchRef = db.collection("warehouseProjects").doc(projectId).collection("dispatches").doc(dispatchId);
  const dDoc = await dispatchRef.get();
  const dData = dDoc.exists ? dDoc.data() : {};

  await dispatchRef.delete();

  await logWarehouseAudit(projectId, {
    action: "DELETE_DISPATCH",
    userUid,
    userEmail,
    userName,
    details: {
      dispatchId,
      dispatchNumber: dData.dispatchNumber || dispatchId,
    },
  });

  return { success: true, dispatchId };
}

/**
 * Item Aliases Management (Cross-reference mapping between Schüco, Canex, etc.)
 */
async function getProjectItemAliases(projectId) {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection("warehouseProjects").doc(projectId).collection("itemAliases").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Error getting item aliases:", err.message);
    return [];
  }
}

async function saveProjectItemAlias(projectId, { aliasCode, targetItemCode, targetItemKey, targetDescription, userUid, userEmail, userName }) {
  const db = getDb();
  if (!db) throw new Error("Database not connected");
  if (!projectId || !aliasCode || (!targetItemCode && !targetItemKey)) {
    throw new Error("Missing required alias data");
  }

  const cleanAlias = String(aliasCode).trim();
  const cleanDocId = cleanAlias.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

  const projectRef = db.collection("warehouseProjects").doc(projectId);
  const aliasRef = projectRef.collection("itemAliases").doc(cleanDocId);

  const aliasPayload = {
    aliasCode: cleanAlias,
    cleanDocId,
    targetItemCode: String(targetItemCode || "").trim(),
    targetItemKey: targetItemKey || null,
    targetDescription: targetDescription || "",
    createdBy: userUid || null,
    createdByEmail: userEmail || null,
    createdByName: userName || null,
    updatedAt: new Date().toISOString(),
  };

  await aliasRef.set(aliasPayload, { merge: true });

  // Also add to the target stock item document if targetItemKey exists
  if (targetItemKey) {
    try {
      const stockRef = projectRef.collection("stock").doc(targetItemKey);
      await stockRef.set(
        {
          aliases: admin.firestore.FieldValue.arrayUnion(cleanAlias),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (sErr) {
      console.warn("Could not update target stock item aliases field:", sErr.message);
    }
  }

  await logWarehouseAudit(projectId, {
    action: "LINK_ITEM_ALIAS",
    userUid,
    userEmail,
    userName,
    details: {
      aliasCode: cleanAlias,
      targetItemCode,
      targetItemKey,
    },
  });

  return { success: true, alias: aliasPayload };
}

async function deleteProjectItemAlias(projectId, aliasDocId, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Database not connected");

  const aliasRef = db.collection("warehouseProjects").doc(projectId).collection("itemAliases").doc(aliasDocId);
  const snap = await aliasRef.get();
  if (!snap.exists) return { success: true };

  const data = snap.data();
  await aliasRef.delete();

  if (data.targetItemKey && data.aliasCode) {
    try {
      const stockRef = db.collection("warehouseProjects").doc(projectId).collection("stock").doc(data.targetItemKey);
      await stockRef.update({
        aliases: admin.firestore.FieldValue.arrayRemove(data.aliasCode),
      });
    } catch (e) {}
  }

  await logWarehouseAudit(projectId, {
    action: "DELETE_ITEM_ALIAS",
    userUid,
    userEmail,
    userName,
    details: {
      aliasDocId,
      aliasCode: data.aliasCode,
    },
  });

  return { success: true };
}

/**
 * Reconciles outbound invoices with 0 cost (calculates real cost from inbound prices)
 * and closes active Delmar dispatches fulfilled by those delivery orders.
 */
async function reconcileDelmarAndCosts(projectId, targetInvoiceNumber = null, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");
  projectId = await resolveProjectId(db, projectId);
  const projectRef = db.collection("warehouseProjects").doc(projectId);
  const nowIso = new Date().toISOString();

  let invoicesUpdated = 0;
  let dispatchesClosed = 0;

  // 1. Fetch outbound invoices
  const invSnap = await projectRef.collection("invoices")
    .where("movementType", "==", "outbound")
    .get();

  for (const invDoc of invSnap.docs) {
    const invData = invDoc.data() || {};
    if (targetInvoiceNumber && invData.invoiceNumber !== targetInvoiceNumber && !invData.invoiceNumber.includes(targetInvoiceNumber)) {
      continue;
    }

    // If totalAmount is 0 or target specified
    if (Number(invData.totalAmount || 0) === 0 || targetInvoiceNumber) {
      const mvtSnap = await projectRef.collection("movements")
        .where("invoiceId", "==", invDoc.id)
        .get();

      let invTotal = 0;
      let batch = db.batch();
      let bCount = 0;

      for (const mDoc of mvtSnap.docs) {
        const m = mDoc.data() || {};
        let bPrice = Number(m.barPrice || 0);
        let uPrice = Number(m.unitPrice || 0);
        let nTotal = Number(m.netTotal || 0);

        if (nTotal === 0 || (bPrice === 0 && uPrice === 0)) {
          const resolved = await resolveItemInboundCost(projectRef, m.itemKey, m.itemCode, m.customerCode, m.lengthMm);
          bPrice = resolved.barPrice || 0;
          uPrice = resolved.unitPrice || 0;
          nTotal = (m.quantityBar > 0 && bPrice > 0) ? (m.quantityBar * bPrice) : (m.quantityLm * uPrice);

          batch.update(mDoc.ref, {
            barPrice: bPrice,
            unitPrice: uPrice,
            netTotal: nTotal,
            updatedAt: nowIso,
          });
          bCount++;
        }
        invTotal += nTotal;
      }

      if (bCount > 0) {
        await batch.commit();
      }

      if (invTotal > 0 || Number(invData.totalAmount || 0) === 0) {
        await invDoc.ref.update({
          totalAmount: invTotal,
          updatedAt: nowIso,
        });
        invoicesUpdated++;
      }
    }
  }

  // 2. Fulfill and close active Delmar dispatches for matching outbound invoices
  const activeDispatchesSnap = await projectRef.collection("dispatches")
    .where("isCompleted", "==", false)
    .get();

  if (!activeDispatchesSnap.empty) {
    for (const invDoc of invSnap.docs) {
      const invData = invDoc.data() || {};
      if (invData.isCancelled || invData.status === "cancelled") continue;
      if (targetInvoiceNumber && invData.invoiceNumber !== targetInvoiceNumber && !invData.invoiceNumber.includes(targetInvoiceNumber)) {
        continue;
      }

      const isDelmarOut = Boolean(invData.delmarAllocated) ||
        String(invData.coatingSupplier || "").toLowerCase().includes("delmar") ||
        String(invData.coatingSupplier || "").includes("دلمار") ||
        (invData.invoiceNumber && invData.invoiceNumber.startsWith("SD-"));

      if (isDelmarOut) {
        const mvtSnap = await projectRef.collection("movements")
          .where("invoiceId", "==", invDoc.id)
          .get();
        const lines = mvtSnap.docs.map(d => d.data());

        const closed = await fulfillDelmarDispatches(projectRef, invData, lines, userUid, userEmail, userName);
        dispatchesClosed += closed;

        // Auto-correct warehouse deduction for Delmar portion if it was wrongly deducted from main warehouse
        if (closed > 0) {
          let restoreBatch = db.batch();
          let rCount = 0;
          for (const mDoc of mvtSnap.docs) {
            const m = mDoc.data() || {};
            const qBar = Number(m.quantityBar || 0);
            const dBars = Number(m.delmarDispatchedBars || 0);
            if (dBars === 0 && qBar > 0) {
              const stockRef = projectRef.collection("stock").doc(m.itemKey);
              restoreBatch.set(stockRef, {
                quantityBar: admin.firestore.FieldValue.increment(qBar),
                quantityLm: admin.firestore.FieldValue.increment(Number(m.quantityLm || 0)),
                updatedAt: nowIso,
              }, { merge: true });
              rCount++;

              restoreBatch.update(mDoc.ref, {
                delmarCovered: true,
                delmarMode: "full",
                delmarDispatchedBars: qBar,
                updatedAt: nowIso,
              });
              rCount++;
            }
          }
          if (rCount > 0) {
            await restoreBatch.commit();
          }
        }
      }
    }
  }

  return {
    success: true,
    invoicesUpdated,
    dispatchesClosed,
    message: `تم تدقيق التكاليف وتحديث عدد (${invoicesUpdated}) فواتير صرف، وإغلاق وتسليم عدد (${dispatchesClosed}) أوامر دلمار بنجاح!`,
  };
}


module.exports = {
  reconcileDelmarAndCosts,
  getUserWarehouseAccess,
  listWarehouseUsers,
  updateWarehouseUserAccess,
  listProjects,
  createProject,
  deleteProject,
  getProjectStock,
  processInboundInvoice,
  processManualStockMovement,
  getProjectDispatches,
  updateDispatchStage,
  deleteProjectDispatch,
  getProjectInvoices,
  getProjectMovements,
  getItemMovementsHistory,
  updateStockItem,
  deleteStockItem,
  updateInvoiceMetadata,
  logWarehouseAudit,
  getWarehouseAuditLogs,
  createProjectRestorePoint,
  createAutoRestorePoint,
  listProjectRestorePoints,
  restoreProjectToPoint,
  deleteProjectRestorePoint,
  rollbackInvoiceTransaction,
  getProjectItemAliases,
  saveProjectItemAlias,
  deleteProjectItemAlias,
};

