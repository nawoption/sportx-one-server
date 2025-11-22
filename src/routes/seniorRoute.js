const seniorController = require("../controllers/seniorController");
const router = require("express").Router();
const { adminAuth, seniorAuth } = require("../middlewares/authMiddlewares");
const { validateBody } = require("../middlewares/validator");
const { loginSchema, changePasswordSchema } = require("../validations/commonValidation");
const { accountCreateSchema, accountUpdateSchema } = require("../validations/accountValidation");

// Senior routes
router.post("/login", validateBody(loginSchema), seniorController.login);
router.get("/profile/detail", seniorAuth, seniorController.getProfile);
router.put("/profile/change-password", seniorAuth, validateBody(changePasswordSchema), seniorController.changePassword);
router.post("/generate-access-token", seniorController.generateAccessToken);
router.get("/verify-token", seniorAuth, seniorController.verifyToken);

// Admin routes
router.post("/register/by-admin", validateBody(accountCreateSchema), adminAuth, seniorController.register);
router.get("/all/by-admin", adminAuth, seniorController.getAllSeniors);
router.put("/:id/update-status/by-admin", adminAuth, seniorController.updateStatus);
router.put("/:id/reset-password/by-admin", adminAuth, seniorController.resetPassword);

router
    .route("/:id/by-admin")
    .get(adminAuth, seniorController.getProfile)
    .put(adminAuth, validateBody(accountUpdateSchema), seniorController.updateProfile)
    .delete(adminAuth, seniorController.deleteProfile);

module.exports = router;
