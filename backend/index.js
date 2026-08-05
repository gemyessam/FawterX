require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const excelRoutes = require("./src/routes/excel");
const invoiceRoutes = require("./src/routes/invoice");
const etaRoutes = require("./src/routes/eta");
const adminRoutes = require("./src/routes/admin");
const warehouseRoutes = require("./src/routes/warehouse");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(morgan("dev")); // Logging requests

// Health Check
app.get("/", (req, res) => {
  res.send("ETA Invoice SaaS Backend is running!");
});

// API Routes
app.use("/api/excel", excelRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/eta", etaRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/warehouse", warehouseRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "حدث خطأ داخلي في الخادم", details: err.message });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
