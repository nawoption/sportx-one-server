const router = require("express").Router();
const auth = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const PaymentController = require("../controllers/paymentController");

router.get(
    "/",
    auth,
    requireRole(["Admin", "Super", "Senior", "Master", "Agent"]),
    PaymentController.getMyTransactions
);

router.get(
    "/user/:id",
    auth,
    requireRole(["Admin", "Super", "Senior", "Master", "Agent"]),
    PaymentController.getUserTransactions
);

module.exports = router;
