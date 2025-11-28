const subAccountController = require("../controllers/subAccountController");
const router = require("express").Router();
const { anyAuth } = require("../middlewares/authMiddlewares");

router.post("/create", anyAuth, subAccountController.createSubAccount);

router.get("/all", anyAuth, subAccountController.getSubAccounts);

router.post("/:id/reset-password", anyAuth, subAccountController.resetPassword);

module.exports = router;
