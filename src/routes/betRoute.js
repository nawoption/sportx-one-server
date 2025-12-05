const express = require("express");
const router = express.Router();
const betController = require("../controllers/betController");
const { placeBetSchema } = require("../validations/betValidation");
const { validateBody } = require("../middlewares/validator");
const auth = require("../middlewares/auth");

router.post("/place", auth, betController.placeBet);
router.get("/history", auth, betController.getBettingHistory);

module.exports = router;
