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

  const batch = db.batch();
  const createdMovements = [];

  // 2. Loop through lines
  for (const line of lines) {
    if (line.ignored || line.isService) continue;

    const supplier = line.supplier || invoiceMeta.supplier || "CANEX";
    const itemCode = line.itemCode || line.internalCode || "CODE";
    const customerCode = line.customerCode || "";
    const finish = line.finish || line.color || "STD";
    const lengthMm = Number(line.lengthMm || line.length || 6000);

    const itemKey = line.itemKey || generateItemKey(supplier, itemCode, finish, lengthMm);

    const qtyBar = Number(line.quantityBar || line.quantity || 0);
    const qtyLm = Number(line.quantityLm || (qtyBar * lengthMm) / 1000);
    const qtyKg = Number(line.quantityKg || line.weightKg || 0);
    const unitPrice = Number(line.unitPrice || 0);
    const barPrice = Number(line.barPrice || 0);
    const priceUnit = line.priceUnit || (unitPrice ? "M" : "BAR");
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
        lastMovementType: invoiceDoc.movementType,
        invoiceNumbers: admin.firestore.FieldValue.arrayUnion(invoiceDoc.invoiceNumber),
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

/**
 * Get transaction invoice history for a project
 */
async function getProjectInvoices(projectId) {
  const db = getDb();
  if (!db) return [];

  const snapshot = await db
    .collection("warehouseProjects")
    .doc(projectId)
    .collection("invoices")
    .orderBy("createdAt", "desc")
    .get();

  const invoices = [];
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    let lineItemsCount = Number(data.lineItemsCount || data.movementsCount || 0);
    let totalQuantityBar = Number(data.totalQuantityBar || data.totalBars || 0);
    let totalQuantityLm = Number(data.totalQuantityLm || data.totalLm || 0);

    // Dynamic fallback: query movements if metrics are 0 or undefined
    if (!lineItemsCount || !totalQuantityBar) {
      let mvtsSnapshot = await db
        .collection("warehouseProjects")
        .doc(projectId)
        .collection("movements")
        .where("invoiceId", "==", doc.id)
        .get();

      if (mvtsSnapshot.empty && data.invoiceNumber) {
        mvtsSnapshot = await db
          .collection("warehouseProjects")
          .doc(projectId)
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

    invoices.push({
      id: doc.id,
      ...data,
      lineItemsCount,
      totalQuantityBar,
      totalQuantityLm,
    });
  }

  return invoices;
}

/**
 * Get item movement log for a project or specific invoice
 */
async function getProjectMovements(projectId, invoiceId) {
  const db = getDb();
  if (!db) return [];

  let query = db.collection("warehouseProjects").doc(projectId).collection("movements");
  if (invoiceId) {
    query = query.where("invoiceId", "==", invoiceId);
  }
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update a specific stock item in a project (Admin Only)
 */
async function updateStockItem(projectId, itemKey, updateData, userUid) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");

  const stockRef = db.collection("warehouseProjects").doc(projectId).collection("stock").doc(itemKey);
  const doc = await stockRef.get();
  if (!doc.exists) throw new Error("Stock item not found in warehouse.");

  const existing = doc.data() || {};
  const lengthMm = Number(updateData.lengthMm !== undefined ? updateData.lengthMm : (existing.lengthMm || 6000));
  const qtyBar = Number(updateData.quantityBar !== undefined ? updateData.quantityBar : (existing.quantityBar || 0));
  const qtyLm = Number(updateData.quantityLm !== undefined ? updateData.quantityLm : ((qtyBar * lengthMm) / 1000));
  const qtyKg = Number(updateData.quantityKg !== undefined ? updateData.quantityKg : (existing.quantityKg || 0));

  const payload = {
    itemCode: updateData.itemCode !== undefined ? updateData.itemCode : existing.itemCode,
    customerCode: updateData.customerCode !== undefined ? updateData.customerCode : (existing.customerCode || ""),
    description: updateData.description !== undefined ? updateData.description : existing.description,
    finish: updateData.finish !== undefined ? updateData.finish : existing.finish,
    lengthMm,
    quantityBar: qtyBar,
    quantityLm: qtyLm,
    quantityKg: qtyKg,
    lastUnitCost: updateData.lastUnitCost !== undefined ? Number(updateData.lastUnitCost) : existing.lastUnitCost,
    updatedBy: userUid,
    updatedAt: new Date().toISOString(),
  };

  await stockRef.set(payload, { merge: true });
  return { itemKey, ...existing, ...payload };
}

/**
 * Delete a specific stock item from a project (Admin Only)
 */
async function deleteStockItem(projectId, itemKey) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");

  const stockRef = db.collection("warehouseProjects").doc(projectId).collection("stock").doc(itemKey);
  await stockRef.delete();
  return { itemKey, deleted: true };
}

/**
 * Get movement history for a specific stock item across all invoices
 */
async function getItemMovementsHistory(projectId, itemKey, itemCode) {
  const db = getDb();
  if (!db) return [];

  let querySnapshot = await db
    .collection("warehouseProjects")
    .doc(projectId)
    .collection("movements")
    .where("itemKey", "==", itemKey)
    .get();

  if (querySnapshot.empty && itemCode) {
    querySnapshot = await db
      .collection("warehouseProjects")
      .doc(projectId)
      .collection("movements")
      .where("itemCode", "==", itemCode)
      .get();
  }

  const movements = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

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

module.exports = {
  getUserWarehouseAccess,
  listWarehouseUsers,
  updateWarehouseUserAccess,
  listProjects,
  createProject,
  getProjectStock,
  processInboundInvoice,
  getProjectInvoices,
  getProjectMovements,
  getItemMovementsHistory,
  updateStockItem,
  deleteStockItem,
};
