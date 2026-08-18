const { generateSecret, generateURI, verifySync } = require("otplib");
const QRCode = require("qrcode");

/**
 * Generate a new TOTP secret and QR code for a user
 * @param {string} userEmail - User's email address
 */
async function generateTotpSetup(userEmail) {
  const secret = generateSecret();
  const serviceName = "FawterX";
  const emailLabel = userEmail || "user@fawterx.com";
  
  const otpAuthUrl = generateURI({
    issuer: serviceName,
    label: emailLabel,
    secret,
  });

  // Generate QR Code as Base64 Data URL
  const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 240,
    color: {
      dark: "#0b0d19",
      light: "#ffffff",
    },
  });

  return {
    secret,
    otpAuthUrl,
    qrCodeDataUrl,
  };
}

/**
 * Verify a 6-digit TOTP token against a secret
 * @param {string} token - 6-digit token from Google Authenticator
 * @param {string} secret - User's TOTP secret key
 */
function verifyTotpToken(token, secret) {
  if (!token || !secret) return false;
  try {
    const cleanToken = token.toString().trim();
    if (cleanToken.length !== 6) return false;

    const res = verifySync({
      token: cleanToken,
      secret: secret.trim(),
      window: 1, // Allow 30s before and after for clock tolerance
    });

    return !!(res && res.valid);
  } catch (err) {
    console.error("[TOTP Verification Error]:", err.message);
    return false;
  }
}

module.exports = {
  generateTotpSetup,
  verifyTotpToken,
};
