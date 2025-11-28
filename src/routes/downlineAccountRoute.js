const express = require("express");
const router = express.Router();
const downline = require("../controllers/downlineAccountController");
const auth = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");

// Get direct children
router.get("/direct", auth, requireRole(["Admin", "Super", "Senior", "Master", "Agent"]), downline.getDirectDownline);

// Get FULL tree
router.get("/tree", auth, requireRole(["Admin", "Super", "Senior", "Master", "Agent"]), downline.getDownlineTree);

module.exports = router;
