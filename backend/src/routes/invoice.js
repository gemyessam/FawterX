const express = require("express");
const { mapToETADocument } = require("../utils/etaMapper");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(express.json());

// تطبيق الـ authMiddleware لعزل الجلسات وربط المستندات بالمستخدم الحالي
router.use(authMiddleware);

// ——— POST /api/invoice/generate ———
// يستقبل الـ mapping + rows يولّد ETA JSON
router.post("/generate", (req, res) => {
  try {
    console.log(`=== INVOICE GENERATE for User: ${req.user.uid} ===`);
    const { mapping, rows, issuer, metadata = {} } = req.body || {};

    if (!mapping || !rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "mapping و rows مطلوبين",
      });
    }

    // Validate minimum required mapping fields
    const requiredFields = ["description", "unitValue", "quantity"];
    const missing = requiredFields.filter((f) => !mapping[f]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `الحقول الآتية مطلوبة في الـ mapping: ${missing.join(", ")}`,
      });
    }

    const documents = mapToETADocument(mapping, rows, issuer || {}, metadata);
    return res.json({ success: true, documents });
  } catch (err) {
    console.error("=== SERVER ERROR ===", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ——— POST /api/invoice/preview ———
// معاينة الـ Invoice Lines
router.post("/preview", (req, res) => {
  try {
    console.log(`=== INVOICE PREVIEW for User: ${req.user.uid} ===`);
    const { mapping, rows, metadata = {} } = req.body || {};

    if (!mapping || !rows || !Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: "mapping و rows مطلوبين" });
    }

    const documents = mapToETADocument(mapping, rows, {}, metadata);
    return res.json({
      success: true,
      documents,
      invoiceLines:    documents[0]?.invoiceLines || [],
    });
  } catch (err) {
    console.error("=== SERVER ERROR ===", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
