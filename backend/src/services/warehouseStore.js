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
    return { enabled: true, role: "admin" };
  }

  const db = getDb();
  if (!db || !uid) {
    return { enabled: false, role: "disabled" };
  }

  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return { enabled: false, role: "disabled" };
    }

    const data = userDoc.data() || {};
    const access = data.access && typeof data.access === "object" ? data.access : data;

    const role = String(access.role || data.role || "").toLowerCase();
    if (role === "admin") {
      return { enabled: true, role: "admin" };
    }

    const isEnabled = Boolean(
      data.warehouseEnabled ??
      access.warehouseEnabled ??
      (data.warehouseRole && data.warehouseRole !== "disabled") ??
      (access.warehouseRole && access.warehouseRole !== "disabled")
    );

    const warehouseRole = String(
      data.warehouseRole || access.warehouseRole || (isEnabled ? "warehouse_operator" : "disabled")
    );

    return { enabled: isEnabled, role: isEnabled ? warehouseRole : "disabled" };
  } catch (err) {
    console.error("Error getting warehouse access:", err.message);
    return { enabled: false, role: "disabled" };
  }
}

/**
 * List all users with their warehouse permissions (For Admin UI)
 */
async function listWarehouseUsers() {
  const db = getDb();
  if (!db) return [];

  const snapshot = await db.collection("users").get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    const access = data.access && typeof data.access === "object" ? data.access : data;
    const email = data.email || "";

    const isAdmin = isAdminEmail(email) || String(access.role || data.role || "").toLowerCase() === "admin";
    const isEnabled = isAdmin || Boolean(
      data.warehouseEnabled ??
      access.warehouseEnabled ??
      (data.warehouseRole && data.warehouseRole !== "disabled")
    );

    return {
      uid: doc.id,
      email: email,
      displayName: data.displayName || data.name || email || doc.id,
      role: access.role || data.role || "user",
      warehouseEnabled: isEnabled,
      warehouseRole: isAdmin ? "admin" : (data.warehouseRole || access.warehouseRole || (isEnabled ? "warehouse_operator" : "disabled")),
    };
  });
}

/**
 * Update user warehouse permission (Admin Action)
 */
async function updateWarehouseUserAccess(targetUid, { warehouseEnabled, warehouseRole }, actorEmail) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");

  const userRef = db.collection("users").doc(targetUid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) throw new Error("Target user not found.");

  const enabled = Boolean(warehouseEnabled);
  const role = enabled ? (warehouseRole || "warehouse_operator") : "disabled";

  const updatePayload = {
    warehouseEnabled: enabled,
    warehouseRole: role,
    warehouseAccessUpdatedAt: new Date().toISOString(),
    warehouseAccessUpdatedBy: actorEmail || "admin",
  };

  await userRef.set(updatePayload, { merge: true });

  return { uid: targetUid, warehouseEnabled: enabled, warehouseRole: role };
}

/**
 * List warehouse projects (creates default Canex Stock if empty)
 */
async function listProjects() {
  const db = getDb();
  if (!db) return [];

  const snapshot = await db.collection("warehouseProjects").get();
  let projects = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (projects.length === 0) {
    const defaultProject = {
      name: "Canex Stock",
      code: "CANEX",
      description: "المخزن الرئيسي لقطاعات وإكسسوارات كانكس",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ref = await db.collection("warehouseProjects").add(defaultProject);
    projects = [{ id: ref.id, ...defaultProject }];
  }

  return projects;
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
 * Get current stock snapshot for a project
 */
async function getProjectStock(projectId) {
  const db = getDb();
  if (!db) return [];

  const snapshot = await db.collection("warehouseProjects").doc(projectId).collection("stock").get();
  return snapshot.docs.map((doc) => ({ itemKey: doc.id, ...doc.data() }));
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
 * Process reviewed purchase invoice lines into immutable movements and updated stock
 */
async function processInboundInvoice(projectId, invoiceMeta, lines, userUid) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");

  const projectRef = db.collection("warehouseProjects").doc(projectId);

  const movementType = (invoiceMeta.movementType || "inbound").toLowerCase();
  const isOutbound = movementType === "outbound";
  const docType = isOutbound ? "sales_invoice" : "purchase_invoice";

  // 1. Save Invoice Document
  const invoiceDoc = {
    invoiceNumber: invoiceMeta.invoiceNumber || `INV-${Date.now()}`,
    supplier: invoiceMeta.supplier || "Canex",
    documentType: docType,
    movementType: isOutbound ? "outbound" : "inbound",
    currency: invoiceMeta.currency || "EGP",
    totalAmount: Number(invoiceMeta.totalAmount || 0),
    fileName: invoiceMeta.fileName || "manual_upload",
    uploadedBy: userUid,
    status: "reviewed_and_saved",
    createdAt: new Date().toISOString(),
  };

  const invRef = await projectRef.collection("invoices").add(invoiceDoc);
  const invoiceId = invRef.id;

  const batch = db.batch();
  const createdMovements = [];

  // 2. Loop through lines
  for (const line of lines) {
    if (line.ignored || line.isService) continue;

    const supplier = line.supplier || invoiceMeta.supplier || "CANEX";
    const itemCode = line.itemCode || line.internalCode || "CODE";
    const finish = line.finish || line.color || "STD";
    const lengthMm = Number(line.lengthMm || line.length || 6000);

    const itemKey = line.itemKey || generateItemKey(supplier, itemCode, finish, lengthMm);

    const qtyBar = Number(line.quantityBar || line.quantity || 0);
    const qtyLm = Number(line.quantityLm || (qtyBar * lengthMm) / 1000);
    const qtyKg = Number(line.quantityKg || line.weightKg || 0);
    const unitPrice = Number(line.unitPrice || 0);
    const netTotal = Number(line.netTotal || qtyBar * unitPrice);

    // Factors for stock balance updates (+ for inbound, - for outbound)
    const factorBar = isOutbound ? -qtyBar : qtyBar;
    const factorLm = isOutbound ? -qtyLm : qtyLm;
    const factorKg = isOutbound ? -qtyKg : qtyKg;

    // Create Movement
    const mvtRef = projectRef.collection("movements").doc();
    const movementData = {
      invoiceId,
      invoiceNumber: invoiceDoc.invoiceNumber,
      movementType: isOutbound ? "outbound" : "inbound",
      itemKey,
      itemCode,
      description: line.description || "Glazing Bead / Profile",
      finish,
      lengthMm,
      unit: line.unit || "BAR",
      quantityBar: qtyBar,
      quantityLm: qtyLm,
      quantityKg: qtyKg,
      unitPrice,
      netTotal,
      currency: invoiceDoc.currency,
      createdBy: userUid,
      createdAt: new Date().toISOString(),
    };
    batch.set(mvtRef, movementData);
    createdMovements.push({ id: mvtRef.id, ...movementData });

    // Update Item Master
    const itemRef = projectRef.collection("items").doc(itemKey);
    batch.set(
      itemRef,
      {
        itemKey,
        itemCode,
        description: line.description || "",
        finish,
        lengthMm,
        unit: line.unit || "BAR",
        secondaryUnit: "LM",
        weightKg: qtyKg,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Update Stock Snapshot
    const stockRef = projectRef.collection("stock").doc(itemKey);
    batch.set(
      stockRef,
      {
        itemKey,
        itemCode,
        description: line.description || "",
        finish,
        lengthMm,
        unit: line.unit || "BAR",
        quantityBar: admin.firestore.FieldValue.increment(factorBar),
        quantityLm: admin.firestore.FieldValue.increment(factorLm),
        quantityKg: admin.firestore.FieldValue.increment(factorKg),
        lastUnitCost: unitPrice,
        currency: invoiceDoc.currency,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  await batch.commit();

  return {
    success: true,
    invoiceId,
    movementType: isOutbound ? "outbound" : "inbound",
    movementsCount: createdMovements.length,
  };
}

module.exports = {
  getUserWarehouseAccess,
  listWarehouseUsers,
  updateWarehouseUserAccess,
  listProjects,
  createProject,
  getProjectStock,
  processInboundInvoice,
};
