require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const excelRoutes = require("./src/routes/excel");
const invoiceRoutes = require("./src/routes/invoice");
const etaRoutes = require("./src/routes/eta");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev")); // Logging requests

// Health Check
app.get("/", (req, res) => {
  res.send("ETA Invoice SaaS Backend is running!");
});

// API Routes
app.use("/api/excel", excelRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/eta", etaRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "حدث خطأ داخلي في الخادم" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
