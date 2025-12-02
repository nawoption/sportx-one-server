const express = require("express");
const router = express.Router();
const betController = require("../controllers/betController");
const { placeBetSchema } = require("../validations/betValidation");
const { validateBody } = require("../middlewares/validator");
const auth = require("../middlewares/auth");

router.post("/place", auth, validateBody(placeBetSchema), betController.placeBet);
router.post("/settle/:slipId", betController.settleBet);

router.get("/history", auth, betController.getBetHistory);

module.exports = router;
