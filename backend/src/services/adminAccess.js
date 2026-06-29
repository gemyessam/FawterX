const ADMIN_EMAIL = (process.env.FAWTERX_ADMIN_EMAIL || "gemy.essam.ge@gmail.com").toLowerCase();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdminEmail(email) {
  return normalizeEmail(email) === ADMIN_EMAIL;
}

module.exports = {
  ADMIN_EMAIL,
  normalizeEmail,
  isAdminEmail,
};
