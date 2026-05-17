const fs   = require("fs");
const path = require("path");

// مسار ملف الـ drafts (JSON file في مجلد backend)
const DRAFTS_FILE = path.join(__dirname, "../../drafts.json");

/**
 * يقرأ كل الـ drafts من الـ file
 */
function loadDrafts() {
  if (!fs.existsSync(DRAFTS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DRAFTS_FILE, "utf8"));
  } catch {
    return {};
  }
}

/**
 * يحفظ الـ drafts على الـ file
 */
function saveDrafts(drafts) {
  fs.writeFileSync(DRAFTS_FILE, JSON.stringify(drafts, null, 2), "utf8");
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
 * يحفظ draft جديد للمستخدم
 * @param {string} userId          - معرف المستخدم الفريد (Firebase UID)
 * @param {object} document        - ETA Document
 * @param {object} validationResult - نتيجة الـ validation
 * @returns {object} - الـ draft المحفوظ
 */
function saveDraft(userId, document, validationResult) {
  const drafts  = loadDrafts();
  const draftId = generateDraftId();
  const now     = new Date().toISOString();

  let internalID = "";
  let issuerName = "";
  let receiverName = "";
  let totalAmount = 0;
  let linesCount = 0;

  if (Array.isArray(document)) {
    internalID = document.map(d => d.internalID).filter(Boolean).join(", ");
    issuerName = document[0]?.issuer?.name || "";
    receiverName = document.map(d => d.receiver?.name).filter(Boolean).join(", ");
    totalAmount = document.reduce((acc, d) => acc + (d.totalAmount || 0), 0);
    linesCount = document.reduce((acc, d) => acc + (d.invoiceLines?.length || 0), 0);
  } else {
    internalID = document.internalID || "";
    issuerName = document.issuer?.name || "";
    receiverName = document.receiver?.name || "";
    totalAmount = document.totalAmount || 0;
    linesCount = document.invoiceLines?.length || 0;
  }

  const draft = {
    draftId,
    userId:           userId || "mock-saas-user-uid", // عزل الجلسات
    createdAt:        now,
    updatedAt:        now,
    status:           validationResult.valid ? "valid" : "invalid",
    internalID,
    issuerName,
    receiverName,
    totalAmount,
    linesCount,
    validationResult,
    document,
  };

  drafts[draftId] = draft;
  saveDrafts(drafts);

  console.log(`[DraftStore] ✅ Draft saved: ${draftId} for User: ${userId}`);
  return draft;
}

/**
 * يجيب draft بـ ID معين مع التحقق من هوية المستخدم
 */
function getDraft(userId, draftId) {
  const drafts = loadDrafts();
  const draft = drafts[draftId];
  if (draft && draft.userId === userId) {
    return draft;
  }
  return null;
}

/**
 * يجيب كل الـ drafts الخاصة بمستخدم محدد
 */
function getAllDrafts(userId) {
  const drafts = loadDrafts();
  return Object.values(drafts)
    .filter(d => d.userId === userId)
    .map(d => ({
      draftId:      d.draftId,
      createdAt:    d.createdAt,
      status:       d.status,
      internalID:   d.internalID,
      issuerName:   d.issuerName,
      receiverName: d.receiverName,
      totalAmount:  d.totalAmount,
      linesCount:   d.linesCount,
      errorsCount:  d.validationResult?.errors?.length || 0,
    }));
}

/**
 * يحذف draft بـ ID معين بعد التحقق من الملكية
 */
function deleteDraft(userId, draftId) {
  const drafts = loadDrafts();
  const draft = drafts[draftId];
  if (!draft || draft.userId !== userId) return false;
  
  delete drafts[draftId];
  saveDrafts(drafts);
  console.log(`[DraftStore] 🗑️ Draft deleted: ${draftId} by User: ${userId}`);
  return true;
}

module.exports = { saveDraft, getDraft, getAllDrafts, deleteDraft };
