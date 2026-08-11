const admin = require("./firebaseAdmin");

// ═══════════════════════════════════════════════════════════════════
// Firestore-First Draft & Submission History Store
// كل البيانات مربوطة بـ userId ومحفوظة في Firestore بشكل آمن ومعزول
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
 * يولّد Draft ID فريد
 */
function generateDraftId() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DRAFT-${ts}-${rand}`;
}

/**
 * يحفظ draft جديد للمستخدم في Firestore
 */
/**
 * يحفظ مسودة استرجاع (Recovery Draft) للمستخدم بأدنى بيانات ممكنة لحماية الخصوصية:
 * 1. رقم الفاتورة (internalID)
 * 2. المبلغ الإجمالي (totalAmount)
 * 3. حالة الرفع/الامتثال (status: uploaded | valid | invalid)
 * 4. تفاصيل الخطأ في حال عدم الامتثال/الفشل (errorMessage)
 * 5. تاريخ الإنشاء (createdAt)
 * (يتم استبعاد طرود السطور والتفاصيل الحساسة الأخرى تماماً لحماية الخصوصية)
 */
async function saveDraft(userId, document, validationResult, uploadStatus = null, customError = null) {
  const db = getDb();
  const draftId = generateDraftId();
  const now = new Date().toISOString();

  let internalID = "";
  let totalAmount = 0;

  if (Array.isArray(document)) {
    internalID = document.map(d => d.internalID || d.invoiceNumber).filter(Boolean).join(", ");
    totalAmount = document.reduce((acc, d) => acc + (Number(d.totalAmount || d.total || 0)), 0);
  } else if (document) {
    internalID = document.internalID || document.invoiceNumber || "";
    totalAmount = Number(document.totalAmount || document.total || 0);
  }

  let errorMessage = "";
  if (customError) {
    errorMessage = typeof customError === "string" ? customError : (customError.message || JSON.stringify(customError));
  } else if (validationResult && !validationResult.valid && Array.isArray(validationResult.errors)) {
    errorMessage = validationResult.errors.map(e => e.message || e).join(" | ").slice(0, 300);
  }

  const isUploaded = uploadStatus === "uploaded" || uploadStatus === true;
  const status = isUploaded ? "uploaded" : (validationResult?.valid !== false ? "valid" : "invalid");

  // Minimal Privacy Data Storage
  const draft = {
    draftId,
    userId,
    internalID: internalID || "N/A",
    totalAmount: Number(totalAmount || 0),
    status,
    errorMessage: errorMessage || null,
    createdAt: now,
    updatedAt: now,
  };

  if (db && userId) {
    try {
      await db.collection("users").doc(userId).collection("drafts").doc(draftId).set(draft);
      console.log(`[DraftStore] ✅ Minimal privacy draft saved for user ${userId}: ${draftId} [${status}]`);
      return draft;
    } catch (e) {
      console.warn("[DraftStore] Firestore write error:", e.message);
    }
  }

  return draft;
}

/**
 * يجيب draft بـ ID معين مع التحقق من هوية المستخدم
 */
async function getDraft(userId, draftId) {
  const db = getDb();
  if (db) {
    try {
      const docSnap = await db.collection("users").doc(userId).collection("drafts").doc(draftId).get();
      if (docSnap.exists) {
        return docSnap.data();
      }
    } catch (e) {
      console.warn("[DraftStore] Firestore read error:", e.message);
    }
  }
  return null;
}

/**
 * يجيب كل الـ drafts الخاصة بمستخدم محدد
 */
async function getAllDrafts(userId) {
  const db = getDb();
  if (db) {
    try {
      const snapshot = await db.collection("users").doc(userId).collection("drafts")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      return snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          draftId:      d.draftId,
          createdAt:    d.createdAt,
          status:       d.status || (d.uploaded ? "uploaded" : "invalid"),
          internalID:   d.internalID || "N/A",
          totalAmount:  Number(d.totalAmount || 0),
          errorMessage: d.errorMessage || (d.validationResult?.errors?.[0]?.message) || null,
        };
      });
    } catch (e) {
      console.warn("[DraftStore] Firestore query error:", e.message);
    }
  }
  return [];
}

/**
 * يحذف draft بـ ID معين بعد التحقق من الملكية
 */
async function deleteDraft(userId, draftId) {
  const db = getDb();
  if (db) {
    try {
      const docRef = db.collection("users").doc(userId).collection("drafts").doc(draftId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) return false;
      await docRef.delete();
      console.log(`[DraftStore] 🗑️ Draft deleted from Firestore: ${draftId} by User: ${userId}`);
      return true;
    } catch (e) {
      console.warn("[DraftStore] Firestore delete error:", e.message);
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════
// سجل العمليات — يحفظ كل عملية إرسال (قبول أو رفض) مع التفاصيل
// ═══════════════════════════════════════════════════════════════════

/**
 * يسجل عملية إرسال في سجل العمليات (سواء نجحت أو فشلت)
 */
async function recordOperation(userId, operationData) {
  const db = getDb();
  const opId = `OP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();

  const operation = {
    operationId: opId,
    userId,
    timestamp:   now,
    type:        operationData.type || "submission",        // submission | dryRun
    status:      operationData.status || "unknown",          // accepted | rejected | error
    internalID:  operationData.internalID || "",
    issuerName:  operationData.issuerName || "",
    receiverName: operationData.receiverName || "",
    totalAmount: operationData.totalAmount || 0,
    requestId:   operationData.requestId || "",               // submissionUUID from ETA
    etaResponse: operationData.etaResponse || null,           // ملخص رد ETA
    errorDetails: operationData.errorDetails || null,         // تفاصيل الخطأ إن وُجد
    linesCount:  operationData.linesCount || 0,
  };

  if (db) {
    try {
      await db.collection("users").doc(userId).collection("operations").doc(opId).set(operation);
      console.log(`[Operations] ✅ Operation recorded: ${opId} [${operation.status}] for User: ${userId}`);
      return operation;
    } catch (e) {
      console.warn("[Operations] Firestore write error:", e.message);
    }
  }

  console.warn("[Operations] ⚠️ Firestore unavailable — operation not persisted");
  return operation;
}

/**
 * يجيب كل العمليات الخاصة بمستخدم محدد
 */
async function getAllOperations(userId) {
  const db = getDb();
  if (db) {
    try {
      const snapshot = await db.collection("users").doc(userId).collection("operations")
        .orderBy("timestamp", "desc")
        .limit(200)
        .get();
      return snapshot.docs.map(doc => doc.data());
    } catch (e) {
      console.warn("[Operations] Firestore query error:", e.message);
    }
  }
  return [];
}

module.exports = { saveDraft, getDraft, getAllDrafts, deleteDraft, recordOperation, getAllOperations };
