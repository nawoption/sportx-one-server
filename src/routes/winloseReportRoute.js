const router = require("express").Router();
const winloseReportController = require("../controllers/winloseReportController");
const auth = require("../middlewares/auth");

// Route to generate win/lose report for the logged-in user and their downline
router.get("/", auth, winloseReportController.generateWinLoseReport);

module.exports = router;
