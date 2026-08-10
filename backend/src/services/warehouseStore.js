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

    const isAdmin = isAdminEmail(email) || String(access.role || data.role || "").toLowerCase() === "admin";
    const isEnabled = isAdmin || Boolean(
      data.warehouseEnabled ??
      access.warehouseEnabled ??
      (data.warehouseRole && data.warehouseRole !== "disabled")
    );

    return {
      uid: uid,
      email: email,
      displayName: data.displayName || data.name || email || uid,
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

  const enabled = Boolean(warehouseEnabled);
  const role = enabled ? (warehouseRole || "warehouse_operator") : "disabled";

  const updatePayload = {
    email,
    displayName,
    warehouseEnabled: enabled,
    warehouseRole: role,
    warehouseAccessUpdatedAt: new Date().toISOString(),
    warehouseAccessUpdatedBy: actorEmail || "admin",
    updatedAt: new Date().toISOString(),
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

  const defaultProjectData = {
    name: "Canex Stock",
    code: "CANEX",
    description: "المخزن الرئيسي لقطاعات وإكسسوارات كانكس",
    status: "active",
  };

  // Ensure default_canex exists
  let hasDefault = projects.some((p) => p.id === "default_canex" || p.code === "CANEX");
  if (!hasDefault) {
    await db.collection("warehouseProjects").doc("default_canex").set({
      ...defaultProjectData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    projects.unshift({ id: "default_canex", ...defaultProjectData });
  }

  // Deduplicate and ensure default_canex project is present with id "default_canex"
  const projectMap = new Map();
  projects.forEach((p) => {
    const isCanex = p.id === "default_canex" || p.code === "CANEX";
    const id = isCanex ? "default_canex" : p.id;
    if (!projectMap.has(id)) {
      projectMap.set(id, { ...p, id, name: isCanex ? "Canex Stock" : (p.name || id) });
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

  // Fallback: If stock is empty or target is default_canex, scan all project collections in Firestore
  if (stockMap.size === 0 || projectId === "default_canex") {
    try {
      const allProjSnap = await db.collection("warehouseProjects").get();
      for (const pDoc of allProjSnap.docs) {
        if (pDoc.id !== projectId) {
          await fetchStockFromProj(pDoc.id);
        }
      }
    } catch (err) {
      console.warn("Error scanning all warehouseProjects for stock:", err.message);
    }
  }

  // Enrich stock items with invoice numbers from movements history if missing or incomplete
  const itemInvoicesMap = new Map(); // key/code -> Set of invoice numbers
  const itemLatestInvoiceMap = new Map(); // key/code -> { invoiceNumber, createdAt }

  const fetchMovementsForEnrichment = async (pid) => {
    try {
      const mvtsSnap = await db.collection("warehouseProjects").doc(pid).collection("movements").get();
      mvtsSnap.docs.forEach((mDoc) => {
        const mData = mDoc.data() || {};
        const invNo = mData.invoiceNumber;
        if (!invNo || invNo === "-" || invNo === "—") return;

        const keys = [mData.itemKey, mData.itemCode].filter(Boolean);
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
      });
    } catch (e) {
      console.warn(`Error fetching movements for enrichment in ${pid}:`, e.message);
    }
  };

  await fetchMovementsForEnrichment(projectId);
  if (projectId === "default_canex") {
    try {
      const allProjSnap = await db.collection("warehouseProjects").get();
      for (const pDoc of allProjSnap.docs) {
        if (pDoc.id !== projectId) {
          await fetchMovementsForEnrichment(pDoc.id);
        }
      }
    } catch (err) {
      console.warn("Error scanning all warehouseProjects movements for enrichment:", err.message);
    }
  }

  // Attach enriched invoice numbers and metadata to stock items
  const finalStock = Array.from(stockMap.values()).map((item) => {
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
async function processInboundInvoice(projectId, invoiceMeta, lines, userUid, userEmail, userName) {
  const db = getDb();
  if (!db) throw new Error("Firestore is unavailable.");

  const projectRef = db.collection("warehouseProjects").doc(projectId);

  const movementType = (invoiceMeta.movementType || "inbound").toLowerCase();
  const isOutbound = movementType === "outbound";
  const docType = isOutbound ? "sales_invoice" : "purchase_invoice";

  // Check if an invoice with the same invoiceNumber and movementType already exists
  const targetInvNo = String(invoiceMeta.invoiceNumber || "").trim();
  if (targetInvNo && targetInvNo !== "-" && targetInvNo !== "—") {
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
          const dupBatch = db.batch();
          dupBatch.update(existingDoc.ref, invUpdates);

          const mvtsSnap = await projectRef
            .collection("movements")
            .where("invoiceId", "==", existingId)
            .get();

          const mvtUpdates = {};
          if (invUpdates.salesOrder) mvtUpdates.salesOrder = invUpdates.salesOrder;
          if (invUpdates.customerReference) mvtUpdates.customerReference = invUpdates.customerReference;
          if (invUpdates.supplier) mvtUpdates.supplier = invUpdates.supplier;

          if (Object.keys(mvtUpdates).length > 0) {
            mvtsSnap.docs.forEach((mDoc) => {
              dupBatch.update(mDoc.ref, mvtUpdates);
            });
          }

          await dupBatch.commit();
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
      salesOrder: invoiceDoc.salesOrder,
      customerReference: invoiceDoc.customerReference,
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
        lastSalesOrder: invoiceDoc.salesOrder || "",
        lastCustomerRef: invoiceDoc.customerReference || "",
        lastMovementType: invoiceDoc.movementType,
        invoiceNumbers: admin.firestore.FieldValue.arrayUnion(invoiceDoc.invoiceNumber),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  await batch.commit();

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

  if (invoiceMap.size === 0 || projectId === "default_canex") {
    try {
      const allProjSnap = await db.collection("warehouseProjects").get();
      const otherProjects = allProjSnap.docs.filter((pDoc) => pDoc.id !== projectId);
      await Promise.all(otherProjects.map((pDoc) => fetchInvoicesFromProj(pDoc.id)));
    } catch (err) {
      console.warn("Error scanning all warehouseProjects for invoices:", err.message);
    }
  }

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

  if (mvtMap.size === 0 || projectId === "default_canex") {
    try {
      const allProjSnap = await db.collection("warehouseProjects").get();
      const otherProjects = allProjSnap.docs.filter((pDoc) => pDoc.id !== projectId);
      await Promise.all(otherProjects.map((pDoc) => fetchMovementsFromProj(pDoc.id)));
    } catch (err) {
      console.warn("Error scanning all warehouseProjects for movements:", err.message);
    }
  }

  return Array.from(mvtMap.values());
}

/**
 * Update a specific stock item in a project (Admin Only)
 */
async function updateStockItem(projectId, itemKey, updateData, userUid, userEmail, userName) {
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

  const stockRef = db.collection("warehouseProjects").doc(projectId).collection("stock").doc(itemKey);
  const doc = await stockRef.get();
  const existing = doc.exists ? doc.data() : {};

  await stockRef.delete();

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

  if (mvtMap.size === 0 || projectId === "default_canex") {
    try {
      const allProjSnap = await db.collection("warehouseProjects").get();
      const otherProjects = allProjSnap.docs.filter((pDoc) => pDoc.id !== projectId);
      await Promise.all(otherProjects.map((pDoc) => fetchItemMovementsFromProj(pDoc.id)));
    } catch (err) {
      console.warn("Error scanning all warehouseProjects for movements:", err.message);
    }
  }

  const movements = Array.from(mvtMap.values());

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
  updateInvoiceMetadata,
  logWarehouseAudit,
  getWarehouseAuditLogs,
};
