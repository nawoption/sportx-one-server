const router = require("express").Router();
const dashboardReportController = require("../controllers/dashboardReportController");
const auth = require("../middlewares/auth");

// Route to generate dashboard report
router.get("/report", auth, dashboardReportController.generateDashboardReport);

module.exports = router;
