const router = require("express").Router();

router.use("/admin", require("./adminRoute"));

router.use("/senior", require("./seniorRoute"));

router.use("/master", require("./masterRoute"));

router.use("/agent", require("./agentRoute"));

router.use("/user", require("./userRoute"));

router.use("/payment-transaction", require("./paymentTransactionRoute"));

router.use("/member", require("./memberRoute"));

router.use("/sub-account", require("./subAccountRoute"));

module.exports = router;
