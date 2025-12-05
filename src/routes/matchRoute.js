const express = require("express");
const matchController = require("../controllers/matchController");
const router = express.Router();

// Public routes for fetching match data
router.get("/pre-match", matchController.getPreMatchList);
// router.get("/live", matchController.getLiveMatchList);
router.get("/results", matchController.getMatchResults);
router.get("/:matchId", matchController.getMatchDetail); // Match Detail for a specific ID

module.exports = router;
