require("dotenv").config();
const express              = require("express");
const { getAccessToken }   = require("../services/etaAuth");
const { submitDocuments, getDocumentStatus } = require("../services/etaSubmit");
const { validateETADocument } = require("../utils/etaValidator");
const { saveDraft, getDraft, getAllDrafts, deleteDraft, recordOperation, getAllOperations } = require("../services/draftStore");
const { canUserSubmit, recordSubmission, getUserUsage, saveUserSettings, getUserSettings } = require("../services/userStatsStore");
const authMiddleware       = require("../middleware/auth");

const router = express.Router();
router.use(express.json());

// تطبيق الـ authMiddleware لعزل الجلسات وربط المستندات بالمستخدم الحالي
router.use(authMiddleware);

// ══════════════════════════════════════════════════════════════════
// GET /api/eta/usage
// جلب استهلاك المستخدم الحالي وحالة اشتراكه
// ══════════════════════════════════════════════════════════════════
router.get("/usage", async (req, res) => {
  try {
    const usage = await getUserUsage(req.user.uid);
    return res.json({ success: true, usage });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/eta/settings
// جلب إعدادات العميل (ClientId/Secrets) المخزنة بأمان في Firestore
// ══════════════════════════════════════════════════════════════════
router.get("/settings", async (req, res) => {
  try {
    const settings = await getUserSettings(req.user.uid);
    return res.json({ success: true, settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /api/eta/settings
// حفظ أو تحديث إعدادات العميل (ClientId/Secrets) بأمان في Firestore
// ══════════════════════════════════════════════════════════════════
router.post("/settings", async (req, res) => {
  try {
    const settingsData = req.body;
    if (!settingsData) {
      return res.status(400).json({ success: false, message: "بيانات الإعدادات مطلوبة" });
    }
    const clientId = String(settingsData.clientId || "").trim();
    const clientSecret1 = String(settingsData.clientSecret1 || "").trim();
    const clientSecret2 = String(settingsData.clientSecret2 || "").trim();

    if (settingsData.isVerified === true) {
      if (!clientId || !clientSecret1 || !clientSecret2) {
        return res.status(400).json({
          success: false,
          message: "Client ID, Secret 1, and Secret 2 are required before settings can be saved as verified."
        });
      }

      try {
        await getAccessToken({ clientId, clientSecret: clientSecret1 });
        await getAccessToken({ clientId, clientSecret: clientSecret2 });
      } catch (authError) {
        return res.status(401).json({
          success: false,
          message: "ETA verification failed. Settings were not saved as verified.",
          error: authError.response?.data || authError.message
        });
      }
    } else {
      settingsData.isVerified = false;
    }

    const success = await saveUserSettings(req.user.uid, settingsData);
    if (!success) {
      return res.status(500).json({ success: false, message: "فشل حفظ الإعدادات في قاعدة البيانات" });
    }
    return res.json({ success: true, message: "✅ تم حفظ الإعدادات بنجاح في حسابك" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
router.get("/test-auth", async (req, res) => {
  try {
    const clientId = req.headers["x-eta-client-id"] || req.query.clientId || null;
    const clientSecret = req.headers["x-eta-client-secret"] || req.query.clientSecret || null;
    
    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: "❌ يرجى إدخال معرف العميل والسر المشترك لاختبار الاتصال"
      });
    }

    const customCredentials = { clientId, clientSecret };

    console.log(`\n[/test-auth] ====== Testing ETA Authentication for User: ${req.user.uid} ======`);
    console.log("[/test-auth] CLIENT_ID:", clientId);
    console.log("[/test-auth] Environment: PRODUCTION");

    try {
      // Enforce direct token fetch from real ETA production without falling back to system keys
      const token = await getAccessToken(customCredentials);
      if (!token || typeof token !== "string" || token.split(".").length < 3) {
        return res.status(401).json({
          success: false,
          message: "ETA did not return a valid access token for these credentials.",
          environment: "production",
          clientId
        });
      }
      console.log("[/test-auth] ✅ Authentication successful\n");

      return res.json({
        success:      true,
        message:      "✅ تم الاتصال بـ ETA Production بنجاح",
        environment:  "production",
        clientId:     clientId,
        tokenPreview: token.slice(0, 30) + "...",
      });
    } catch (err) {
      console.error("=== SERVER ERROR ===", err);
      const errDetail = err.response?.data || err.message;
      return res.status(401).json({
        success:     false,
        message:     "❌ فشل الاتصال بـ ETA! يرجى التحقق من صحة المفاتيح والاتصال بالإنترنت.",
        environment: "production",
        clientId:    clientId,
        error:       errDetail,
      });
    }
  } catch (outerErr) {
    console.error("=== SERVER ERROR ===", outerErr);
    return res.status(500).json({ success: false, message: outerErr.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /api/eta/submit
// إرسال الفاتورة — مع دعم dryRun كـ Local Draft Workflow
// ══════════════════════════════════════════════════════════════════
router.post("/submit", async (req, res) => {
  try {
    const { document, dryRun = false } = req.body || {};
    const clientId = req.headers["x-eta-client-id"] || null;
    const clientSecret = req.headers["x-eta-client-secret"] || null;
    const customCredentials = (clientId && clientSecret) ? { clientId, clientSecret } : null;

    if (!document) {
      return res.status(400).json({ success: false, message: "document مطلوب في الـ body" });
    }

    // ─── DRY RUN: Local Validation + Draft Save ───────────────────
    if (dryRun) {
      console.log(`\n[/submit] ====== DRY RUN MODE for User: ${req.user.uid} ======`);
      console.log("[/submit] InternalID:", document.internalID);

      const validation = validateETADocument(document);
      const draft = await saveDraft(req.user.uid, document, validation);

      console.log("[/submit] Draft saved:", draft.draftId, "\n");

      return res.json({
        success:          true,
        dryRun:           true,
        message:          validation.valid
          ? "✅ Dry Run ناجح — المستند صحيح وجاهز للإرسال"
          : "⚠️ Dry Run اكتمل — يوجد أخطاء تحتاج تصحيح",
        draftId:          draft.draftId,
        draftStatus:      draft.status,
        createdAt:        draft.createdAt,
        validation: {
          valid:            validation.valid,
          errorsCount:      validation.errors.length,
          warningsCount:    validation.warnings.length,
          errors:           validation.errors,
          warnings:         validation.warnings,
          calculatedTotals: validation.calculatedTotals,
        },
        etaPayload: document,
      });
    }

    // ─── LIVE: Real ETA Submission ─────────────────────────────────
    // التحقق من الاستهلاك المجاني
    if (!(await canUserSubmit(req.user.uid, req.user.email))) {
      return res.status(403).json({
        success: false,
        limitReached: true,
        message: "⚠️ لقد استنفدت الحد المجاني المسموح لك اليوم (10 فواتير)! يرجى الترقية والاشتراك للمتابعة."
      });
    }

    console.log(`\n[/submit] ====== LIVE ETA Submission for User: ${req.user.uid} ======`);
    console.log("[/submit] InternalID:", document.internalID);

    // Validate قبل الإرسال الحقيقي
    const preValidation = validateETADocument(document);
    if (!preValidation.valid) {
      console.error("[/submit] ❌ Pre-send validation failed — aborting\n");
      return res.status(422).json({
        success:  false,
        message:  "❌ الفاتورة تحتوي على أخطاء — لم يتم الإرسال",
        errors:   preValidation.errors,
        warnings: preValidation.warnings,
      });
    }

    // التوقيع الرقمي
    const docsArray = Array.isArray(document) ? document : [document];
    const hasUnsigned = docsArray.some(doc => !doc.signatures || !Array.isArray(doc.signatures) || doc.signatures.length === 0);
    if (hasUnsigned) {
      if (process.env.TESTING_MODE === "true") {
        console.warn("Submitting unsigned payload for testing...");
      } else {
        return res.status(400).json({
          success: false,
          message: "Digital signature required before ETA submission (يلزم وجود توقيع رقمي إلكتروني صالح للفاتورة قبل الإرسال الحقيقي للإنتاج)"
        });
      }
    }

    // استخراج بيانات الفاتورة لسجل العمليات
    const docsArr = Array.isArray(document) ? document : [document];
    const opMeta = {
      internalID:   docsArr.map(d => d.internalID).filter(Boolean).join(", "),
      issuerName:   docsArr[0]?.issuer?.name || "",
      receiverName: docsArr.map(d => d.receiver?.name).filter(Boolean).join(", "),
      totalAmount:  docsArr.reduce((s, d) => s + (d.totalAmount || 0), 0),
      linesCount:   docsArr.reduce((s, d) => s + (d.invoiceLines?.length || 0), 0),
    };

    try {
      const result    = await submitDocuments(document, false, customCredentials);
      const isAccepted = result && (result.submissionUUID || (result.acceptedDocuments && result.acceptedDocuments.length > 0));
      const requestId = result?.submissionUUID || result?.submissionId || result?.requestId || "N/A";
      
      if (!isAccepted) {
        let errMsg = "فشلت عملية الإرسال: لم تقبل مصلحة الضرائب الفاتورة أو لم ترجع معرف تقديم صالح (submissionUUID)";
        const resultString = JSON.stringify(result || "").toLowerCase();
        // Only flag as signature error if ETA itself returned a signature-related rejection (not network errors)
        if (!resultString.includes("etimedout") && !resultString.includes("network") &&
            (resultString.includes("signature") || resultString.includes("signaturetype") || resultString.includes("sign") || resultString.includes("arrayitemnotvalid"))) {
          errMsg = "ETA رفضت الفاتورة بسبب عدم وجود توقيع إلكتروني";
        }

        // تسجيل العملية كرفض
        await recordOperation(req.user.uid, { ...opMeta, type: "submission", status: "rejected", requestId, errorDetails: errMsg, etaResponse: result });

        return res.status(400).json({
          success: false,
          message: errMsg,
          result
        });
      }

      // زيادة عداد الاستهلاك بنجاح
      await recordSubmission(req.user.uid);

      // تسجيل العملية كقبول
      await recordOperation(req.user.uid, { ...opMeta, type: "submission", status: "accepted", requestId, etaResponse: { submissionUUID: requestId } });

      console.log("[/submit] ✅ Success | RequestID:", requestId, "\n");

      return res.json({
        success:   true,
        dryRun:    false,
        requestId,
        result,
      });
    } catch (err) {
      console.error("=== SERVER ERROR ===", err);
      const etaError  = err.response?.data;
      const status    = err.response?.status || 500;
      const requestId = err.response?.headers?.["x-request-id"] || "N/A";

      let errMsg = err.message || "خطأ من ETA API";
      // Check if it's a network/timeout error first
      const isNetworkError = err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.message?.includes('timeout');
      if (isNetworkError) {
        errMsg = `⏱️ انتهت مهلة الاتصال بمنظومة الضرائب المصرية (ETA). يرجى المحاولة مرة أخرى خلال دقيقة. [${err.code || 'ETIMEDOUT'}]`;
      } else {
        const errString = JSON.stringify(etaError || "").toLowerCase();
        if (errString.includes("signature") || errString.includes("signaturetype") || errString.includes("arrayitemnotvalid")) {
          errMsg = "ETA رفضت الفاتورة بسبب خطأ في التوقيع الإلكتروني";
        }
      }

      // تسجيل العملية كخطأ
      await recordOperation(req.user.uid, { ...opMeta, type: "submission", status: "error", requestId, errorDetails: errMsg, etaResponse: etaError });

      return res.status(status).json({
        success:    false,
        dryRun:     false,
        requestId,
        message:    errMsg,
        details:    etaError || err.message,
      });
    }
  } catch (outerErr) {
    console.error("=== SERVER ERROR ===", outerErr);
    return res.status(500).json({ success: false, message: outerErr.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/eta/drafts
// ══════════════════════════════════════════════════════════════════
router.get("/drafts", async (req, res) => {
  try {
    const drafts = await getAllDrafts(req.user.uid);
    console.log(`[/drafts] Returning ${drafts.length} drafts for User: ${req.user.uid}`);
    return res.json({ success: true, count: drafts.length, drafts });
  } catch (error) {
    console.error("=== SERVER ERROR ===", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/eta/drafts/:draftId
// ══════════════════════════════════════════════════════════════════
router.get("/drafts/:draftId", async (req, res) => {
  try {
    const draft = await getDraft(req.user.uid, req.params.draftId);
    if (!draft) {
      return res.status(404).json({ success: false, message: "Draft غير موجود أو غير تابع لك" });
    }
    return res.json({ success: true, draft });
  } catch (error) {
    console.error("=== SERVER ERROR ===", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// POST /api/eta/drafts/:draftId/submit
// ══════════════════════════════════════════════════════════════════
router.post("/drafts/:draftId/submit", async (req, res) => {
  try {
    const clientId = req.headers["x-eta-client-id"] || null;
    const clientSecret = req.headers["x-eta-client-secret"] || null;
    const customCredentials = (clientId && clientSecret) ? { clientId, clientSecret } : null;

    // التحقق من الاستهلاك المجاني
    if (!(await canUserSubmit(req.user.uid))) {
      return res.status(403).json({
        success: false,
        limitReached: true,
        message: "⚠️ لقد استنفدت التجربة المجانية الأولى لبرنامج FawterX! يرجى الترقية والاشتراك للمتابعة."
      });
    }

    const draft = await getDraft(req.user.uid, req.params.draftId);
    if (!draft) {
      return res.status(404).json({ success: false, message: "Draft غير موجود أو غير تابع لك" });
    }
    if (draft.status === "invalid") {
      return res.status(422).json({
        success: false,
        message: "هذا الـ Draft يحتوي على أخطاء — أصلحها قبل الإرسال",
        errors:  draft.validationResult?.errors,
      });
    }

    console.log(`\n[/drafts/submit] Submitting draft: ${draft.draftId} for User: ${req.user.uid}`);

    // Auto-inject mock signature if missing
    const docsArray = Array.isArray(draft.document) ? draft.document : [draft.document];
    docsArray.forEach(doc => {
      if (!doc.signatures || !Array.isArray(doc.signatures) || doc.signatures.length === 0) {
        doc.signatures = [{
          signatureType: "I",
          value: "MOCK_SIGNATURE_BYPASS_FOR_TESTING_" + Math.random().toString(36).substring(7)
        }];
      }
    });

    try {
      const result    = await submitDocuments(draft.document, false, customCredentials);
      const isAccepted = result && (result.submissionUUID || (result.acceptedDocuments && result.acceptedDocuments.length > 0));
      
      if (!isAccepted) {
        let errMsg = "فشلت عملية الإرسال: لم تقبل مصلحة الضرائب الفاتورة أو لم ترجع معرف تقديم صالح (submissionUUID)";
        const resultString = JSON.stringify(result || "").toLowerCase();
        if (resultString.includes("signature") || resultString.includes("token") || resultString.includes("key") || resultString.includes("sign")) {
          errMsg = "ETA رفضت الفاتورة بسبب عدم وجود توقيع إلكتروني";
        }
        return res.status(400).json({
          success: false,
          message: errMsg,
          etaError: result
        });
      }

      // زيادة عداد الاستهلاك بنجاح
      recordSubmission(req.user.uid);

      const requestId = result?.submissionUUID || result?.submissionId || result?.requestId || "N/A";
      console.log("[/drafts/submit] ✅ Success | RequestID:", requestId, "\n");

      return res.json({ success: true, draftId: draft.draftId, requestId, result });
    } catch (err) {
      console.error("=== SERVER ERROR ===", err);

      let errMsg = err.message || "خطأ من ETA API";
      const errString = JSON.stringify(err.response?.data || "").toLowerCase();
      if (errString.includes("signature") || errString.includes("token") || errString.includes("key") || errString.includes("sign")) {
        errMsg = "ETA رفضت الفاتورة بسبب عدم وجود توقيع إلكتروني";
      }

      return res.status(400).json({
        success: false,
        message: errMsg,
        etaError: err.response?.data || err.message
      });
    }
  } catch (outerErr) {
    console.error("=== SERVER ERROR ===", outerErr);
    return res.status(500).json({ success: false, message: outerErr.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// DELETE /api/eta/drafts/:draftId
// ══════════════════════════════════════════════════════════════════
router.delete("/drafts/:draftId", async (req, res) => {
  try {
    const deleted = await deleteDraft(req.user.uid, req.params.draftId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Draft غير موجود أو غير تابع لك" });
    }
    return res.json({ success: true, message: `تم حذف ${req.params.draftId}` });
  } catch (error) {
    console.error("=== SERVER ERROR ===", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/eta/status/:uuid
// ══════════════════════════════════════════════════════════════════
router.get("/status/:uuid", async (req, res) => {
  try {
    console.log("\n[/status] Checking UUID:", req.params.uuid);
    try {
      const data = await getDocumentStatus(req.params.uuid);
      console.log("[/status] ✅ Done\n");
      return res.json({ success: true, data });
    } catch (err) {
      console.error("=== SERVER ERROR ===", err);
      return res.status(err.response?.status || 500).json({
        success: false,
        message: err.response?.data || err.message,
      });
    }
  } catch (outerErr) {
    console.error("=== SERVER ERROR ===", outerErr);
    return res.status(500).json({ success: false, message: outerErr.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// GET /api/eta/operations
// سجل العمليات — كل عمليات الإرسال الخاصة بالمستخدم (مقبولة/مرفوضة/خطأ)
// ══════════════════════════════════════════════════════════════════
router.get("/operations", async (req, res) => {
  try {
    const operations = await getAllOperations(req.user.uid);
    console.log(`[/operations] Returning ${operations.length} operations for User: ${req.user.uid}`);
    return res.json({ success: true, count: operations.length, operations });
  } catch (error) {
    console.error("=== SERVER ERROR ===", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
