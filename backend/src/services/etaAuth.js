require("dotenv").config();
const axios = require("axios");

// ─── Production URLs ───────────────────────────────────────────────
const ETA_AUTH_URL = "https://id.eta.gov.eg/connect/token";

let cachedToken = null;
let tokenExpiry = null;

/**
 * يجيب Access Token من ETA Production مع caching
 */
async function getAccessToken(customCredentials = null) {
  const now = Date.now();

  // Enforce strict mapping of credentials without fallback if customCredentials is provided
  let clientId, clientSecret;
  if (customCredentials) {
    clientId = customCredentials.clientId;
    clientSecret = customCredentials.clientSecret;
  } else {
    clientId = process.env.CLIENT_ID;
    clientSecret = process.env.CLIENT_SECRET;
  }

  const isDefault = !customCredentials;
  if (isDefault && cachedToken && tokenExpiry && now < tokenExpiry - 60_000) {
    console.log("[ETA Auth] Using cached token ✅");
    return cachedToken;
  }

  if (!clientId || !clientSecret) {
    throw new Error("❌ ETA Client ID أو Client Secret غير موجودين. يرجى ضبط الإعدادات.");
  }

  console.log("[ETA Auth] Requesting new token...");
  console.log("[ETA Auth] CLIENT_ID:", clientId);
  console.log("[ETA Auth] URL:", ETA_AUTH_URL);

  const params = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const response = await axios.post(ETA_AUTH_URL, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const { access_token, expires_in, token_type } = response.data;

  if (isDefault) {
    cachedToken = access_token;
    tokenExpiry = now + expires_in * 1000;
  }

  console.log("[ETA Auth] ✅ Token received successfully");
  console.log("[ETA Auth] Token type:", token_type);
  console.log("[ETA Auth] Expires in:", expires_in, "seconds");

  return access_token;
}

module.exports = { getAccessToken };
