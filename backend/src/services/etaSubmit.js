require("dotenv").config();
const axios = require("axios");
const https = require("https");
const { getAccessToken } = require("./etaAuth");

// ─── Production API URL ────────────────────────────────────────────
const ETA_API_BASE = "https://api.invoicing.eta.gov.eg/api/v1";

/**
 * يرسل document/s لـ ETA Production API
 *
 * @param {object|object[]} documents  - ETA Document(s)
 * @param {boolean}         dryRun     - لو true: يعمل validation فقط بدون حفظ حقيقي
 * @returns {object}
 */
async function submitDocuments(documents, dryRun = false, customCredentials = null) {
  const token = await getAccessToken(customCredentials);

  const docsArray = Array.isArray(documents) ? documents : [documents];

  // التحقق الحقيقي: منظومة الضرائب تشترط وجود التوقيع الإلكتروني، ولكن في وضع الاختبار نسمح بالمرور للحصول على رد المنظومة
  if (!dryRun) {
    const hasUnsigned = docsArray.some(d => !d.signatures || !Array.isArray(d.signatures) || d.signatures.length === 0);
    if (hasUnsigned) {
      if (process.env.TESTING_MODE === "true") {
        console.warn("Submitting unsigned payload for testing...");
      } else {
        throw new Error("Digital signature required before ETA submission (لم يتم العثور على توقيع إلكتروني رقمي صالح في الفاتورة)");
      }
    }
  }

  // REMOVED: Post-signing document mutations have been removed to guarantee byte-for-byte 
  // hash accuracy between the local signer and ETA's recalculation. 
  // ETA schema compliance is now strictly enforced upstream during generation (etaMapper).

  const payload = {
    documents: docsArray,
  };

  console.log("=== JSON BEFORE SUBMISSION ===");
  console.log(JSON.stringify(docsArray, null, 2));

  const url = dryRun
    ? `${ETA_API_BASE}/documentsubmissions?dryRun=true`
    : `${ETA_API_BASE}/documentsubmissions`;

  console.log(`[ETA Submit] Mode: ${dryRun ? "🧪 DRY RUN" : "🚀 LIVE"}`);
  console.log("[ETA Submit] URL:", url);
  console.log("[ETA Submit] Documents count:", payload.documents.length);
  console.log("[ETA Submit] InternalIDs:", payload.documents.map(d => d.internalID).join(", "));

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 90000, // 90 seconds timeout
      httpsAgent: new https.Agent({ family: 4 }) // Force IPv4
    });

    console.log("=== ETA REAL SUBMIT RESPONSE ===", response.data);
    console.log("=== ETA SUBMIT RESPONSE ===", response.data);
    console.log("[ETA Submit] ✅ Response status:", response.status);
    console.log("[ETA Submit] Response:", JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error("=== ETA FULL ERROR ===", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers
    });

    if (!error.response?.data) {
      console.log("=== ETA REQUEST DETAILS ===", error.request || "No request details available");
    }

    console.error("=== ETA SUBMIT ERROR ===", error.response?.data || error.message);
    throw error;
  }
}

/**
 * يجيب حالة document معين باستخدام UUID
 * @param {string} uuid
 */
async function getDocumentStatus(uuid) {
  const token = await getAccessToken();

  console.log("[ETA Status] Checking UUID:", uuid);

  const response = await axios.get(
    `${ETA_API_BASE}/documents/${uuid}/raw`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log("[ETA Status] ✅ Status received for:", uuid);
  return response.data;
}

module.exports = { submitDocuments, getDocumentStatus };
