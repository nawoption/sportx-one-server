const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const connectDB = require("./config/db");
const config = require("./config");
const cron = require("node-cron");

// Middleware setup
app.use(cors());
app.use(express.json());

// Static files serving for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//Routes set
app.use("/api", require("./routes/index"));

// Connect to Database
connectDB();

// Import settlement service for scheduled tasks
const settlementService = require("./services/settlementService");

// Schedule the job to run every 5 seconds for demonstration (change as needed)
// cron.schedule("*/55 * * * * *", async () => {
//     await settlementService.runSettlementJob();
// });

// 404 Error handling
app.use((req, res, next) => {
    res.status(404).json({ message: "Route not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Server Error", err });
});

// Start the server
app.listen(config.env.PORT, () => {
    console.log(`Server running on port ${config.env.PORT}`);
});
