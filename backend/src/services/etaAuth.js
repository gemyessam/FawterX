require("dotenv").config();
const axios = require("axios");

// ─── Production URLs ───────────────────────────────────────────────
const ETA_AUTH_URL = "https://id.eta.gov.eg/connect/token";

/**
 * يجيب Access Token من ETA Production باستخدام مفاتيح الشركة المخصصة المرفقة بالطلب حصرياً
 */
async function getAccessToken(customCredentials = null) {
  if (!customCredentials || !customCredentials.clientId || !customCredentials.clientSecret) {
    throw new Error("❌ لم يتم توفير مفاتيح ربط الضرائب (ETA) الخاصة بشركتك في هذا الطلب. يرجى تهيئة واختبار الإعدادات أولاً.");
  }

  const clientId = customCredentials.clientId;
  const clientSecret = customCredentials.clientSecret;

  console.log("[ETA Auth] Requesting fresh token for Client ID:", clientId);
  console.log("[ETA Auth] URL:", ETA_AUTH_URL);

  const params = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const response = await axios.post(ETA_AUTH_URL, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 30000, // 30 seconds — prevent hanging on slow ETA identity server
  });

  const { access_token, expires_in, token_type } = response.data;

  console.log("[ETA Auth] ✅ Token received successfully");
  console.log("[ETA Auth] Token type:", token_type);
  console.log("[ETA Auth] Expires in:", expires_in, "seconds");

  return access_token;
}

module.exports = { getAccessToken };
