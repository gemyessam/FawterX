const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/auth");
const { parseWarehouseInvoice } = require("../utils/warehouseCanexParser");
const {
  getUserWarehouseAccess,
  listWarehouseUsers,
  updateWarehouseUserAccess,
  listProjects,
  createProject,
  deleteProject,
  getProjectStock,
  processInboundInvoice,
  getProjectInvoices,
  getProjectMovements,
  getItemMovementsHistory,
  updateStockItem,
  deleteStockItem,
  updateInvoiceMetadata,
  getWarehouseAuditLogs,
  createProjectRestorePoint,
  listProjectRestorePoints,
  restoreProjectToPoint,
  deleteProjectRestorePoint,
} = require("../services/warehouseStore");

const router = express.Router();
router.use(express.json());
router.use(authMiddleware);

const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = [".xlsx", ".xls", ".csv", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Warehouse invoice must be Excel, CSV, or PDF."));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * GET /api/warehouse/access
 * Check current user's warehouse access permissions
 */
router.get("/access", async (req, res) => {
  try {
    const access = await getUserWarehouseAccess(req.user.uid, req.user.email);
    return res.json({ success: true, ...access });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Middleware: Require Warehouse Permission & Project ACL
 */
async function requireWarehouse(req, res, next) {
  try {
    const access = await getUserWarehouseAccess(req.user.uid, req.user.email);
    if (!access.enabled) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Warehouse access is disabled for your account. Please contact Admin.",
      });
    }
    req.warehouseRole = access.role;
    req.warehouseAccess = access;

    // Check project permission if projectId is specified in the route
    if (req.params.projectId && !access.isAdmin) {
      const allowedProjects = Array.isArray(access.allowedProjects) ? access.allowedProjects : ["*"];
      const requestedProj = String(req.params.projectId);
      const isAllowed = allowedProjects.includes("*") || allowedProjects.includes(requestedProj) || (requestedProj === "default_canex" && allowedProjects.includes("default_canex"));
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You do not have permission to access this warehouse project.",
        });
      }
    }

    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Middleware: Require Admin Only
 */
async function requireAdmin(req, res, next) {
  try {
    if (req.user && req.user.isAdmin) {
      req.warehouseRole = "admin";
      return next();
    }
    const access = await getUserWarehouseAccess(req.user.uid, req.user.email);
    if (!access.enabled || !access.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Action restricted to Admin only.",
      });
    }
    req.warehouseRole = access.role;
    req.warehouseAccess = access;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/warehouse/users
 * List all users with warehouse access (Admin Only)
 */
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await listWarehouseUsers();
    return res.json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/warehouse/users/:uid
 * Enable/Disable warehouse access for a specific user (Admin Only)
 */
router.post("/users/:uid", requireAdmin, async (req, res) => {
  try {
    const { warehouseEnabled, warehouseRole, allowedProjects, canDelete, canEdit, canUpload } = req.body;
    const result = await updateWarehouseUserAccess(
      req.params.uid,
      { warehouseEnabled, warehouseRole, allowedProjects, canDelete, canEdit, canUpload },
      req.user.email
    );
    return res.json({ success: true, access: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/warehouse/projects
 * List warehouse projects (filtered by user ACL)
 */
router.get("/projects", requireWarehouse, async (req, res) => {
  try {
    let projects = await listProjects();
    const access = req.warehouseAccess || {};
    if (!access.isAdmin) {
      const allowed = Array.isArray(access.allowedProjects) ? access.allowedProjects : ["*"];
      if (!allowed.includes("*")) {
        projects = projects.filter(p => allowed.includes(p.id) || (p.code === "CANEX" && allowed.includes("default_canex")));
      }
    }
    return res.json({ success: true, projects });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/warehouse/projects
 * Create a new warehouse project (Admin Only)
 */
router.post("/projects", requireAdmin, async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Project name is required." });
    }
    const project = await createProject({ name, code, description }, req.user.uid);
    return res.json({ success: true, project });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/warehouse/projects/:projectId
 * Delete a warehouse project (Admin only)
 */
router.delete("/projects/:projectId", requireAdmin, async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await deleteProject(projectId, req.user.uid);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/warehouse/projects/:projectId/stock
 * Fetch current stock snapshot for a project
 */
router.get("/projects/:projectId/stock", requireWarehouse, async (req, res) => {
  try {
    const stock = await getProjectStock(req.params.projectId);
    return res.json({ success: true, stock });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/warehouse/invoices/parse
 * Parse a supplier PDF/Excel invoice into warehouse review metadata and lines
 */
router.post("/invoices/parse", requireWarehouse, upload.single("file"), async (req, res) => {
  try {
    if (req.warehouseAccess?.canUpload === false || req.warehouseRole === "warehouse_viewer") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have upload permissions in warehouse." });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No invoice file was uploaded." });
    }

    const result = await parseWarehouseInvoice(req.file.path, req.file.originalname);
    return res.json({
      success: true,
      fileName: req.file.originalname,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    try {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } catch (e) {
      console.error("Failed to delete warehouse upload temp file:", e.message);
    }
  }
});

/**
 * POST /api/warehouse/projects/:projectId/invoices/process
 * Save reviewed purchase invoice & lines into inbound stock movements
 */
router.post("/projects/:projectId/invoices/process", requireWarehouse, async (req, res) => {
  try {
    if (req.warehouseAccess?.canUpload === false || req.warehouseRole === "warehouse_viewer") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have upload/process permissions." });
    }
    const { invoiceMeta, lines } = req.body;
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, message: "At least one valid line is required." });
    }

    const userName = req.user.name || req.user.displayName || req.user.email;
    const result = await processInboundInvoice(
      req.params.projectId,
      invoiceMeta || {},
      lines,
      req.user.uid,
      req.user.email,
      userName
    );
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/warehouse/projects/:projectId/invoices
 * Fetch transaction invoice history for a project
 */
router.get("/projects/:projectId/invoices", requireWarehouse, async (req, res) => {
  try {
    const invoices = await getProjectInvoices(req.params.projectId);
    return res.json({ success: true, invoices });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/warehouse/projects/:projectId/audit-logs
 * Fetch audit logs for warehouse operations (Admin Only)
 */
router.get("/projects/:projectId/audit-logs", requireAdmin, async (req, res) => {
  try {
    const logs = await getWarehouseAuditLogs(req.params.projectId);
    return res.json({ success: true, logs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/warehouse/projects/:projectId/invoices/:invoiceId/movements
 * Fetch granular stock movements for a specific transaction/invoice
 */
router.get("/projects/:projectId/invoices/:invoiceId/movements", requireWarehouse, async (req, res) => {
  try {
    const movements = await getProjectMovements(req.params.projectId, req.params.invoiceId);
    return res.json({ success: true, movements });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/warehouse/projects/:projectId/stock/:itemKey/movements
 * Fetch transaction history for a specific stock item across all invoices
 */
router.get("/projects/:projectId/stock/:itemKey/movements", requireWarehouse, async (req, res) => {
  try {
    const { itemCode } = req.query;
    const movements = await getItemMovementsHistory(req.params.projectId, req.params.itemKey, itemCode);
    return res.json({ success: true, movements });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/warehouse/projects/:projectId/stock/:itemKey
 * Update stock item details & quantity (Admin Only)
 */
router.put("/projects/:projectId/stock/:itemKey", requireAdmin, async (req, res) => {
  try {
    const userName = req.user.name || req.user.displayName || req.user.email;
    const result = await updateStockItem(
      req.params.projectId,
      req.params.itemKey,
      req.body,
      req.user.uid,
      req.user.email,
      userName
    );
    return res.json({ success: true, item: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/warehouse/projects/:projectId/stock/:itemKey
 * Delete stock item from inventory (Admin Only)
 */
router.delete("/projects/:projectId/stock/:itemKey", requireAdmin, async (req, res) => {
  try {
    const userName = req.user.name || req.user.displayName || req.user.email;
    const result = await deleteStockItem(
      req.params.projectId,
      req.params.itemKey,
      req.user.uid,
      req.user.email,
      userName
    );
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/warehouse/projects/:projectId/invoices/:invoiceId
 * Update invoice metadata (Sales Order & Customer Reference)
 */
router.patch("/projects/:projectId/invoices/:invoiceId", requireWarehouse, async (req, res) => {
  try {
    if (req.warehouseAccess?.canEdit === false || req.warehouseRole === "warehouse_viewer") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have edit permissions in warehouse." });
    }
    const { salesOrder, customerReference } = req.body;
    const userName = req.user.name || req.user.displayName || req.user.email;
    const result = await updateInvoiceMetadata(
      req.params.projectId,
      req.params.invoiceId,
      { salesOrder, customerReference },
      req.user.uid,
      req.user.email,
      userName
    );
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/warehouse/projects/:projectId/restore-points
 * Fetch all restore points for a project
 */
router.get("/projects/:projectId/restore-points", requireWarehouse, async (req, res) => {
  try {
    const points = await listProjectRestorePoints(req.params.projectId);
    return res.json({ success: true, points });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/warehouse/projects/:projectId/restore-points
 * Create a new restore point (snapshot) for a project
 */
router.post("/projects/:projectId/restore-points", requireWarehouse, async (req, res) => {
  try {
    if (req.warehouseAccess?.canEdit === false || req.warehouseRole === "warehouse_viewer") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to create restore points." });
    }
    const { name, description } = req.body;
    const userName = req.user.name || req.user.displayName || req.user.email;
    const result = await createProjectRestorePoint(
      req.params.projectId,
      { name, description },
      req.user.uid,
      req.user.email,
      userName
    );
    return res.json({ success: true, point: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/warehouse/projects/:projectId/restore-points/:pointId/restore
 * Restore project stock to a specific restore point (Admin or authorized warehouse user)
 */
router.post("/projects/:projectId/restore-points/:pointId/restore", requireWarehouse, async (req, res) => {
  try {
    if (req.warehouseAccess?.canEdit === false || req.warehouseRole === "warehouse_viewer") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to restore project state." });
    }
    const userName = req.user.name || req.user.displayName || req.user.email;
    const result = await restoreProjectToPoint(
      req.params.projectId,
      req.params.pointId,
      req.user.uid,
      req.user.email,
      userName
    );
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/warehouse/projects/:projectId/restore-points/:pointId
 * Delete a restore point
 */
router.delete("/projects/:projectId/restore-points/:pointId", requireWarehouse, async (req, res) => {
  try {
    if (req.warehouseAccess?.canDelete === false || req.warehouseRole === "warehouse_viewer") {
      return res.status(403).json({ success: false, message: "Forbidden: You do not have delete permissions in warehouse." });
    }
    const userName = req.user.name || req.user.displayName || req.user.email;
    const result = await deleteProjectRestorePoint(
      req.params.projectId,
      req.params.pointId,
      req.user.uid,
      req.user.email,
      userName
    );
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

