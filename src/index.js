const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const connectDB = require("./config/db");
const config = require("./config");

// Middleware setup
app.use(cors());
app.use(express.json());

// Static files serving for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//Routes set
app.use("/api", require("./routes/index"));

// Connect to Database
connectDB();

// Start Cron Jobs
const { startCronJob } = require("./utils/dataFetcher");
const { startSettlementJob } = require("./utils/settlementJob");

startSettlementJob();
startCronJob();

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
