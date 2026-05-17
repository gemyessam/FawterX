const express  = require("express");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const { parseExcel, getSheetNames } = require("../utils/excelParser");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// تطبيق الـ authMiddleware لعزل الجلسات وربط المستندات بالمستخدم الحالي
router.use(authMiddleware);

// ——— Multer Setup ———
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = [".xlsx", ".xls", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("الملف يجب أن يكون Excel أو CSV"));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const uploadMiddleware = (req, res, next) => {
  try {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("=== SERVER ERROR ===", err);
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  } catch (err) {
    console.error("=== SERVER ERROR ===", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ——— POST /api/excel/upload ———
// رفع الملف وإرجاع الـ headers + أول 10 rows للـ preview
router.post("/upload", uploadMiddleware, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "لم يتم رفع أي ملف" });
    }

    const { headers, rows, sheetName, parserDebugInfo, metadata } = parseExcel(req.file.path);
    console.log(`[Excel Upload] User: ${req.user.uid} uploaded file: ${req.file.originalname}`);

    return res.json({
      success:   true,
      filePath:  req.file.path,
      fileName:  req.file.originalname,
      sheetName,
      headers,
      totalRows: rows.length,
      preview:   rows.slice(0, 10), // أول 10 rows
      rows,
      parserDebugInfo,
      metadata,
    });
  } catch (err) {
    console.error("=== SERVER ERROR ===", err);
    try {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (e) {
      console.error("Failed to delete temp file:", e);
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ——— POST /api/excel/parse ———
// يقرأ ملف مرفوع بالفعل ويرجع كل الـ rows (بعد الـ mapping)
router.post("/parse", express.json(), (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, message: "filePath مطلوب" });
    }

    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(uploadsDir))) {
      return res.status(403).json({ success: false, message: "مسار غير مسموح به" });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ success: false, message: "الملف غير موجود" });
    }

    const { headers, rows, sheetName, metadata } = parseExcel(resolved);
    return res.json({ success: true, sheetName, headers, totalRows: rows.length, rows, metadata });
  } catch (err) {
    console.error("=== SERVER ERROR ===", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
