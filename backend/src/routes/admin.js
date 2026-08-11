const express = require("express");
const authMiddleware = require("../middleware/auth");
const { isAdminEmail } = require("../services/adminAccess");
const { listUsers, getUserById, updateUserAccess, getAdminStats } = require("../services/adminStore");

const router = express.Router();
router.use(express.json());
router.use(authMiddleware);

function requireAdmin(req, res, next) {
  const userEmail = String(req.user?.email || "").toLowerCase().trim();
  const isAdmin = req.user?.isAdmin || isAdminEmail(userEmail) || userEmail === "gemy.essam.ge@gmail.com";
  if (!req.user || !isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: admin access is restricted to the approved administrator account.",
    });
  }
  return next();
}

router.use(requireAdmin);

router.get("/stats", async (req, res) => {
  try {
    const stats = await getAdminStats();
    return res.json({ success: true, stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await listUsers();
    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/users/:uid", async (req, res) => {
  try {
    const user = await getUserById(req.params.uid);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/users/:uid", async (req, res) => {
  try {
    const updated = await updateUserAccess(req.params.uid, req.body || {}, req.user.email);
    return res.json({ success: true, user: updated });
  } catch (error) {
    const status = /not found/i.test(error.message) ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

module.exports = router;
