const agentController = require("../controllers/agentController");
const router = require("express").Router();
const { adminAuth, agentAuth, seniorAuth, masterAuth, canEditAgent } = require("../middlewares/authMiddlewares");
const { validateBody } = require("../middlewares/validator");
const { loginSchema, changePasswordSchema } = require("../validations/commonValidation");
const { accountCreateSchema, accountUpdateSchema } = require("../validations/accountValidation");

// Agent routes
router.post("/login", validateBody(loginSchema), agentController.login);
router.get("/profile/detail", agentAuth, agentController.getProfile);
router.put("/profile/change-password", agentAuth, validateBody(changePasswordSchema), agentController.changePassword);
router.post("/generate-access-token", agentController.generateAccessToken);
router.get("/verify-token", agentAuth, agentController.verifyToken);

// Master routes
router.post("/register/by-master", validateBody(accountCreateSchema), masterAuth, agentController.register);
router.get("/all/by-master", masterAuth, agentController.getAllAgents);
router.put("/:id/update-status/by-master", masterAuth, canEditAgent, agentController.updateStatus);
router.put("/:id/reset-password/by-master", masterAuth, canEditAgent, agentController.resetPassword);

router
    .route("/:id/by-master")
    .get(masterAuth, agentController.getProfile)
    .put(masterAuth, canEditAgent, validateBody(accountUpdateSchema), agentController.updateProfile);

// Senior routes
router.post("/register/by-senior", validateBody(accountCreateSchema), seniorAuth, agentController.register);
router.get("/all/by-senior", seniorAuth, agentController.getAllAgents);
router.put("/:id/update-status/by-senior", seniorAuth, canEditAgent, agentController.updateStatus);
router.put("/:id/reset-password/by-senior", seniorAuth, canEditAgent, agentController.resetPassword);

router
    .route("/:id/by-senior")
    .get(seniorAuth, agentController.getProfile)
    .put(seniorAuth, canEditAgent, validateBody(accountUpdateSchema), agentController.updateProfile);

// Admin routes
router.post("/register/by-admin", adminAuth, validateBody(accountCreateSchema), agentController.register);
router.get("/all/by-admin", adminAuth, agentController.getAllAgents);
router.put("/:id/update-status/by-admin", adminAuth, canEditAgent, agentController.updateStatus);
router.put("/:id/reset-password/by-admin", adminAuth, canEditAgent, agentController.resetPassword);

router
    .route("/:id/by-admin")
    .get(adminAuth, agentController.getProfile)
    .put(adminAuth, canEditAgent, validateBody(accountUpdateSchema), agentController.updateProfile)
    .delete(adminAuth, canEditAgent, agentController.deleteProfile);

module.exports = router;
