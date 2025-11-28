const AuthController = require("../controllers/authController");
const router = require("express").Router();
const auth = require("../middlewares/auth");

router.post("/sub/create", auth, AuthController.createSubAccount);
router.post("/login", AuthController.login);
router.get("/profile", auth, AuthController.getProfile);
router.put("/change-password", auth, AuthController.changePassword);

module.exports = router;
