const express = require("express");
const router = express.Router();
const betController = require("../controllers/betController");
const { PlaceBetSchema } = require("../validations/betValidation");
const { validateBody } = require("../middlewares/validator");
const auth = require("../middlewares/auth");

router.post("/place", auth, validateBody(PlaceBetSchema), betController.placeBet);
router.get("/history", auth, betController.getBettingHistory);
router.get("/history/:slipId", auth, betController.getBetDetail);

module.exports = router;
