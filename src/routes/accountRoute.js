const router = require("express").Router();
const auth = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const AccountController = require("../controllers/accountController");
const { accountCreateSchema } = require("../validations/accountValidation");
const { validateBody } = require("../middlewares/validator");

router.post(
    "/create",
    auth,
    requireRole(["Admin", "Super", "Senior", "Master", "Agent"]),
    validateBody(accountCreateSchema),
    AccountController.createAccount
);
router.get("/:id", auth, AccountController.getAccountById);
router.get("/by-role/:role", auth, AccountController.getAccountsByRole);
router.put(
    "/:id/update-status",
    auth,
    requireRole(["Admin", "Super", "Senior", "Master", "Agent"]),
    AccountController.updateStatus
);
router.put(
    "/:id/reset-password",
    auth,
    requireRole(["Admin", "Super", "Senior", "Master", "Agent"]),
    AccountController.resetPassword
);
router.put(
    "/:id/update-profile",
    auth,
    requireRole(["Admin", "Super", "Senior", "Master", "Agent"]),
    AccountController.updateProfile
);

module.exports = router;
