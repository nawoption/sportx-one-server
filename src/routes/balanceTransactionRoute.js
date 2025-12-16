const express = require("express");
const router = express.Router();
const balanceTransactionController = require("../controllers/balanceTransactionController");
const auth = require("../middlewares/auth");

router.get("/:id", auth, balanceTransactionController.getTransactionsByBetSlip);

module.exports = router;
