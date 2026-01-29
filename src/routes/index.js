const router = require("express").Router();

router.use("/user", require("./accountRoute"));

router.use("/auth", require("./authRoute"));

router.use("/downline-users", require("./downlineAccountRoute"));

router.use("/balance", require("./balanceRoute"));

router.use("/payment-transaction", require("./paymentRoute"));

router.use("/bets", require("./betRoute"));

router.use("/betlist", require("./betlistRoute"));

router.use("/winlose-report", require("./winloseReportRoute"));

router.use("/match-report", require("./matchReportRoute"));

router.use("/matches", require("./matchRoute"));

router.use("/balance-transaction", require("./balanceTransactionRoute"));

router.use("/dashboard", require("./dashboardRoute"));

module.exports = router;
