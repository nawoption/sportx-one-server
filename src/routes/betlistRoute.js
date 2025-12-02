const express = require("express");
const router = express.Router();
const betlistController = require("../controllers/betlistController");
const auth = require("../middlewares/auth");

router.get("/downlines/:betType", auth, betlistController.getDownlineBets);

router.get("/check/:slipId", betlistController.checkSlipExists);

module.exports = router;
