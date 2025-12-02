const BetSlip = require("../models/betslipModel");
const downlineService = require("../services/downlineService");

/**
 * Retrieves all single or parlay bet slips placed by the current user's downlines.
 * @param {string} req.params.betType - 'single' or 'parlay'.
 * @param {string} req.user._id - The ID of the logged-in user (Super/Master/Agent).
 */
exports.getDownlineBets = async (req, res) => {
    try {
        let { startDate, endDate, page, limit } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        // 1. Validate Input
        const { betType } = req.params;
        if (!["single", "parlay", "all"].includes(betType)) {
            return res.status(400).json({ error: "Invalid bet type specified. Must be 'single', 'parlay', or 'all'." });
        }

        const loggedInUserId = req.user._id;

        // Get all Downline IDs recursively
        const userIdsToQuery = await downlineService.getAllDownlineIds(loggedInUserId);

        // Construct the Query
        const query = {
            user: { $in: userIdsToQuery }, // Match all collected downline IDs
            status: { $in: ["pending", "won", "lost", "half-won", "half-lost"] }, // Exclude cancelled, etc.
        };

        if (betType !== "all") {
            query.betType = betType; // Apply filter for 'single' or 'parlay'
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        const totalBets = await BetSlip.countDocuments(query);

        //  Execute the Query and Retrieve Bets (Adding pagination is highly recommended here)
        const downlineBets = await BetSlip.find(query)
            .sort({ createdAt: -1 }) // Show newest bets first
            .skip(skip)
            .limit(limit)
            .populate("user", "username role")
            .select("-__v -updatedAt");

        res.json({
            total: totalBets,
            page: page,
            limit: limit,
            totalPages: Math.ceil(totalBets / limit),
            data: downlineBets,
        });
    } catch (err) {
        console.error("Error retrieving downline bets:", err);
        res.status(500).json({ error: "Internal Server Error during downline bet retrieval." });
    }
};

exports.checkSlipExists = async (req, res) => {
    try {
        const { slipId } = req.params;

        const exists = await BetSlip.findOne({ slipId: slipId }).lean();

        if (exists) {
            // Return 200 OK if the slip is found
            res.status(200).json({ exists: true, message: `Slip ID ${slipId} is valid.`, data: exists });
        } else {
            // Return 404 Not Found if the slip does not exist
            res.status(404).json({ exists: false, message: `Slip ID ${slipId} not found.` });
        }
    } catch (err) {
        console.error("Error checking slip existence:", err);
        res.status(500).json({ error: "Internal Server Error during slip check." });
    }
};
