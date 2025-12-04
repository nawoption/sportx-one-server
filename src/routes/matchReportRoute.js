const router = require("express").Router();
const matchReportController = require("../controllers/matchReportController");
const auth = require("../middlewares/auth");

router.get("/", auth, matchReportController.generateBodyOuReport);

router.get("/outstanding", auth, matchReportController.getMemberOutstandingReport);

router.get("/outstanding/detailed/:targetUserId", auth, matchReportController.getMemberBetDetailReport);

router.get("/stock-detail/:matchId/:period", auth, matchReportController.getMatchStockDetailReport);

module.exports = router;
