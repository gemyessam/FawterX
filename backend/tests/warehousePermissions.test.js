jest.mock("../src/middleware/auth", () => (req, res, next) => next());

// Mock Firebase Admin prior to loading warehouseStore for pure isolation
const mockCanexDocs = [{ id: "real-canex-id" }];
const mockCollection = jest.fn((colName) => {
  if (colName === "warehouseProjects") {
    return {
      doc: (id) => ({
        collection: (subCol) => ({
          limit: () => ({
            get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
          }),
        }),
      }),
      where: jest.fn((field, op, val) => ({
        limit: () => ({
          get: jest.fn().mockResolvedValue({
            empty: val !== "CANEX",
            docs: val === "CANEX" ? mockCanexDocs : [],
          }),
        }),
      })),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    };
  }
  return {};
});

const mockFirestore = jest.fn(() => ({
  collection: mockCollection,
}));

jest.mock("../src/services/firebaseAdmin", () => ({
  apps: [{ name: "mock-test-app" }],
  firestore: mockFirestore,
  auth: jest.fn(),
}));

const express = require("express");
const http = require("http");

// Load warehouseStore and its real exported resolveProject
const warehouseStore = require("../src/services/warehouseStore");
const { resolveProject } = warehouseStore;

describe("Warehouse Permissions & Security Enforcement (FX-001 / Phase 1)", () => {
  let app;
  let server;
  let baseUrl;

  // Mock state for user access
  let currentAccess = {
    enabled: true,
    role: "warehouse_operator",
    isAdmin: false,
    allowedProjects: ["proj-1", "real-canex-id", "default_canex"],
    canDelete: false,
    canEdit: true,
    canUpload: true,
    canDispatch: true,
    canManual: true,
  };

  let currentUser = {
    uid: "test-user-uid",
    email: "user@example.com",
    name: "Test User",
    isAdmin: false,
  };

  let mockReconcile;
  let mockProcessInbound;
  let mockProcessManual;
  let mockDeleteProject;
  let mockGetStock;

  beforeAll((done) => {
    // Spy on getUserWarehouseAccess to simulate various ACL / role states
    jest.spyOn(warehouseStore, "getUserWarehouseAccess").mockImplementation(async () => {
      return { ...currentAccess };
    });

    // NOTE: resolveProject is NOT spied or mocked! We test the real exported implementation.
    mockReconcile = jest.spyOn(warehouseStore, "reconcileDelmarAndCosts").mockImplementation(async () => {
      return { invoicesUpdated: 1, dispatchesClosed: 1, message: "ok" };
    });

    mockProcessInbound = jest.spyOn(warehouseStore, "processInboundInvoice").mockImplementation(async () => {
      return { invoiceId: "inv-123", movementsCount: 2 };
    });

    mockProcessManual = jest.spyOn(warehouseStore, "processManualStockMovement").mockImplementation(async () => {
      return { success: true, movementId: "mvt-123" };
    });

    mockDeleteProject = jest.spyOn(warehouseStore, "deleteProject").mockImplementation(async () => {
      return { deleted: true };
    });

    mockGetStock = jest.spyOn(warehouseStore, "getProjectStock").mockImplementation(async () => {
      return [];
    });

    app = express();
    app.use(express.json());

    // Inject user context before warehouse router
    app.use((req, res, next) => {
      req.user = { ...currentUser };
      if (!currentUser.withoutToken) req.headers.authorization = 'Bearer isolated-test-token';
      next();
    });

    const warehouseRouter = require("../src/routes/warehouse");
    app.use("/api/warehouse", warehouseRouter);

    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    jest.restoreAllMocks();
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentAccess = {
      enabled: true,
      role: "warehouse_operator",
      isAdmin: false,
      allowedProjects: ["proj-1", "real-canex-id", "default_canex"],
      canDelete: false,
      canEdit: true,
      canUpload: true,
      canDispatch: true,
      canManual: true,
    };
    currentUser = {
      uid: "test-user-uid",
      email: "user@example.com",
      name: "Test User",
      isAdmin: false,
    };
  });

  describe("1. Real exported resolveProject function verification", () => {
    test("warehouseStore must export resolveProject as an async function", () => {
      expect(typeof resolveProject).toBe("function");
    });

    test("real resolveProject preserves exact default_canex identity", async () => {
      const resolved = await resolveProject("default_canex");
      expect(resolved).toBe("default_canex");
    });

    test("real resolveProject returns standard project ID unchanged", async () => {
      const resolved = await resolveProject("proj-abc-123");
      expect(resolved).toBe("proj-abc-123");
    });
  });

  describe("2. Project ACL and Alias Resolution in requireWarehouse & requireAdmin", () => {
    test("should deny access (403) when user warehouse access is disabled", async () => {
      currentAccess.enabled = false;
      currentAccess.role = "disabled";

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/stock`);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(mockGetStock).not.toHaveBeenCalled();
    });

    test("should deny access (403) when user is not authorized for requested project", async () => {
      currentAccess.allowedProjects = ["other-project"];

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/stock`);
      expect(res.status).toBe(403);
      expect(mockGetStock).not.toHaveBeenCalled();
    });

    test("should deny access (403) for default_canex when allowedProjects belongs to another project and NEVER call service", async () => {
      currentAccess.allowedProjects = ["unrelated-project-only"];

      const res = await fetch(`${baseUrl}/api/warehouse/projects/default_canex/stock`);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(mockGetStock).not.toHaveBeenCalled();
    });

    test("should allow access and pass resolvedProjectId when allowedProjects contains default_canex alone", async () => {
      currentAccess.allowedProjects = ["default_canex"]; // Only alias in ACL

      const res = await fetch(`${baseUrl}/api/warehouse/projects/default_canex/stock`);
      expect(res.status).toBe(200);
      expect(mockGetStock).toHaveBeenCalledWith("default_canex");
    });

    test("a grant to another CANEX ID never authorizes default_canex", async () => {
      currentAccess.allowedProjects = ["real-canex-id"];
      const res = await fetch(`${baseUrl}/api/warehouse/projects/default_canex/stock`);
      expect(res.status).toBe(403);
      expect(mockGetStock).not.toHaveBeenCalled();
    });

    test("should allow access when user has wildcard '*' in allowedProjects", async () => {
      currentAccess.allowedProjects = ["*"];

      const res = await fetch(`${baseUrl}/api/warehouse/projects/any-project-id/stock`);
      expect(res.status).toBe(200);
      expect(mockGetStock).toHaveBeenCalledWith("any-project-id");
    });

    test("requireAdmin should set resolvedProjectId when req.user.isAdmin = true", async () => {
      currentUser.isAdmin = true;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/default_canex`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      expect(mockDeleteProject).toHaveBeenCalledWith("default_canex", currentUser.uid);
    });

    test("requireAdmin should set resolvedProjectId when user is admin via warehouseAccess", async () => {
      currentUser.isAdmin = false;
      currentAccess.isAdmin = true;
      currentAccess.role = "admin";

      const res = await fetch(`${baseUrl}/api/warehouse/projects/default_canex`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      expect(mockDeleteProject).toHaveBeenCalledWith("default_canex", currentUser.uid);
    });

    test("requireAdmin should deny access (403) to non-admin users", async () => {
      currentUser.isAdmin = false;
      currentAccess.isAdmin = false;
      currentAccess.role = "warehouse_operator";

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
      expect(mockDeleteProject).not.toHaveBeenCalled();
    });
  });

  describe("Restore authorization", () => {
    test("warehouse routes reject missing tokens even outside production mode", async () => {
      currentUser.withoutToken = true;
      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/stock`);
      expect(res.status).toBe(401);
      expect(mockGetStock).not.toHaveBeenCalled();
    });
    test("operators with canEdit cannot overwrite all warehouse state", async () => {
      currentAccess.canEdit = true;
      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/restore-points/point/restore`, { method: "POST" });
      expect(res.status).toBe(403);
    });
    test("legacy ACL cannot read another same-code project by its real ID", async () => {
      currentAccess.allowedProjects = ["default_canex"];
      const res = await fetch(`${baseUrl}/api/warehouse/projects/real-canex-id/stock`);
      expect(res.status).toBe(403);
    });
  });

  describe("3. POST /projects/:projectId/reconcile-delmar-and-costs", () => {
    test("should deny warehouse_viewer role with 403 and NEVER call reconcileDelmarAndCosts", async () => {
      currentAccess.role = "warehouse_viewer";
      currentAccess.canEdit = true;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/reconcile-delmar-and-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: "INV-100" }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.message).toMatch(/permissions/i);
      expect(mockReconcile).not.toHaveBeenCalled();
    });

    test("should deny user with canEdit=false with 403 and NEVER call reconcileDelmarAndCosts", async () => {
      currentAccess.role = "warehouse_operator";
      currentAccess.canEdit = false;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/reconcile-delmar-and-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: "INV-100" }),
      });

      expect(res.status).toBe(403);
      expect(mockReconcile).not.toHaveBeenCalled();
    });

    test("should allow authorized user with canEdit=true and pass resolvedProjectId", async () => {
      currentAccess.role = "warehouse_operator";
      currentAccess.canEdit = true;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/default_canex/reconcile-delmar-and-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: "INV-100" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockReconcile).toHaveBeenCalledWith(
        "default_canex",
        "INV-100",
        currentUser.uid,
        currentUser.email,
        currentUser.name
      );
    });
  });

  describe("4. POST /projects/:projectId/invoices/process", () => {
    test("should deny warehouse_viewer with 403 and NOT call processInboundInvoice", async () => {
      currentAccess.role = "warehouse_viewer";

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/invoices/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceMeta: { movementType: "inbound" },
          lines: [{ itemCode: "ITEM-1", quantity: 10 }],
        }),
      });

      expect(res.status).toBe(403);
      expect(mockProcessInbound).not.toHaveBeenCalled();
    });

    test("should deny canUpload=false with 403 and NOT call processInboundInvoice", async () => {
      currentAccess.canUpload = false;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/invoices/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceMeta: { movementType: "inbound" },
          lines: [{ itemCode: "ITEM-1", quantity: 10 }],
        }),
      });

      expect(res.status).toBe(403);
      expect(mockProcessInbound).not.toHaveBeenCalled();
    });

    test("should deny canDispatch=false when movementType is 'outbound' with 403", async () => {
      currentAccess.canUpload = true;
      currentAccess.canDispatch = false;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/invoices/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceMeta: { movementType: "outbound" },
          lines: [{ itemCode: "ITEM-1", quantity: 5 }],
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.message).toMatch(/dispatch/i);
      expect(mockProcessInbound).not.toHaveBeenCalled();
    });

    test("should deny canDispatch=false even with unnormalized case and spaces ' Outbound '", async () => {
      currentAccess.canUpload = true;
      currentAccess.canDispatch = false;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/invoices/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceMeta: { movementType: "  Outbound  " },
          lines: [{ itemCode: "ITEM-1", quantity: 5 }],
        }),
      });

      expect(res.status).toBe(403);
      expect(mockProcessInbound).not.toHaveBeenCalled();
    });

    test("should allow canDispatch=false when movementType is 'inbound' (compatibility test)", async () => {
      currentAccess.canUpload = true;
      currentAccess.canDispatch = false;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/default_canex/invoices/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceMeta: { movementType: "Inbound" },
          lines: [{ itemCode: "ITEM-1", quantity: 10 }],
        }),
      });

      expect(res.status).toBe(200);
      expect(mockProcessInbound).toHaveBeenCalled();
      const passedMeta = mockProcessInbound.mock.calls[0][1];
      expect(passedMeta.movementType).toBe("inbound");
      expect(mockProcessInbound.mock.calls[0][0]).toBe("default_canex");
    });

    test("should allow canDispatch=true when movementType is 'outbound'", async () => {
      currentAccess.canUpload = true;
      currentAccess.canDispatch = true;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/invoices/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceMeta: { movementType: "OUTBOUND" },
          lines: [{ itemCode: "ITEM-1", quantity: 5 }],
        }),
      });

      expect(res.status).toBe(200);
      expect(mockProcessInbound).toHaveBeenCalled();
      const passedMeta = mockProcessInbound.mock.calls[0][1];
      expect(passedMeta.movementType).toBe("outbound");
    });
  });

  describe("5. POST /projects/:projectId/manual-movement", () => {
    test("should deny warehouse_viewer with 403 and NOT call processManualStockMovement", async () => {
      currentAccess.role = "warehouse_viewer";

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/manual-movement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementType: "inbound",
          lines: [{ itemCode: "ITEM-1", quantity: 10 }],
        }),
      });

      expect(res.status).toBe(403);
      expect(mockProcessManual).not.toHaveBeenCalled();
    });

    test("should deny canManual=false with 403 and NOT call processManualStockMovement", async () => {
      currentAccess.canManual = false;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/manual-movement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementType: "inbound",
          lines: [{ itemCode: "ITEM-1", quantity: 10 }],
        }),
      });

      expect(res.status).toBe(403);
      expect(mockProcessManual).not.toHaveBeenCalled();
    });

    test("should deny canDispatch=false when movementType is 'OUTBOUND' with spaces ' OUTBOUND '", async () => {
      currentAccess.canManual = true;
      currentAccess.canDispatch = false;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/proj-1/manual-movement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementType: "  OUTBOUND  ",
          lines: [{ itemCode: "ITEM-1", quantity: 5 }],
        }),
      });

      expect(res.status).toBe(403);
      expect(mockProcessManual).not.toHaveBeenCalled();
    });

    test("should allow canDispatch=true on manual outbound and pass normalized movementType", async () => {
      currentAccess.canManual = true;
      currentAccess.canDispatch = true;

      const res = await fetch(`${baseUrl}/api/warehouse/projects/default_canex/manual-movement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementType: " OutBound ",
          lines: [{ itemCode: "ITEM-1", quantity: 5 }],
          meta: {},
        }),
      });

      expect(res.status).toBe(200);
      expect(mockProcessManual).toHaveBeenCalled();
      const passedPayload = mockProcessManual.mock.calls[0][1];
      expect(passedPayload.movementType).toBe("outbound");
      expect(mockProcessManual.mock.calls[0][0]).toBe("default_canex");
    });
  });
});
