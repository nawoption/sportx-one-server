const router = require("express").Router();
const auth = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const BalanceController = require("../controllers/balanceController");

// Logged-in user balance
router.get("/me", auth, BalanceController.getMyBalance);

// Admin only
router.get("/user/:id", auth, requireRole(["Admin"]), BalanceController.getBalanceById);

// Withdraw or Withdraw (Admin/Super/Senior/Master/Agent)
router.post(
    "/create",
    auth,
    requireRole(["Admin", "Super", "Senior", "Master", "Agent"]),
    BalanceController.depositOrWithdraw
);

module.exports = router;
