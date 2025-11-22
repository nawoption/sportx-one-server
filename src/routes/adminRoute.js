const router = require("express").Router();
const adminController = require("../controllers/adminController");
const { createAdminSchema } = require("../validations/adminValidation");
const { validateBody } = require("../middlewares/validator");
const { adminAuth } = require("../middlewares/authMiddlewares");
const { loginSchema, changePasswordSchema } = require("../validations/commonValidation");

// admin routes
router.post("/register", validateBody(createAdminSchema), adminController.createAdmin);
router.post("/login", validateBody(loginSchema), adminController.adminLoign);
router.get("/profile/detail", adminAuth, adminController.getProfile);
router.put("/change-password", adminAuth, validateBody(changePasswordSchema), adminController.changePassword);

module.exports = router;
