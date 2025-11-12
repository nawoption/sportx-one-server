const router = require("express").Router();
const adminController = require("../controllers/adminController");
const { createAdminSchema } = require("../validations/adminValidation");
const { validateBody } = require("../middlewares/validator");
const { adminAuth } = require("../middlewares/authMiddlewares");
const { loginSchema, changePasswordSchema } = require("../validations/commonValidation");

// admin routes
router.post("/register", validateBody(createAdminSchema), adminController.createAdmin);
router.post("/login", validateBody(loginSchema), adminController.adminLoign);
router.put("/change-password", adminAuth, validateBody(changePasswordSchema), adminController.changePassword);
router.get("/", adminAuth, adminController.getAllAdmins);

router.route("/:id").get(adminAuth, adminController.getAdminById).delete(adminAuth, adminController.deleteAdmin);

module.exports = router;
