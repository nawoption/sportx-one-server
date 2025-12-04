const BetSlip = require("../models/betSlipModel");
const Account = require("../models/accountModel"); // Assuming you have this for user details
const Match = require("../models/matchModel"); // For linking match IDs to team names
const downlineService = require("../services/downlineService");
const mongoose = require("mongoose");

// --- UTILITY FUNCTIONS ---

/**
 * Common logic to get the logged-in user's ID and all downline IDs.
 * @param {string} userId - The ID of the logged-in user.
 * @returns {Promise<{loggedInObjectId: mongoose.Types.ObjectId, allUserIds: mongoose.Types.ObjectId[]}>}
 */
const getHierarchyIds = async (userId) => {
    const loggedInObjectId = new mongoose.Types.ObjectId(userId);
    const downlineIds = await downlineService.getAllDownlineIds(userId);
    const allUserIds = [loggedInObjectId, ...downlineIds];
    return { loggedInObjectId, allUserIds };
};

// --- 1. MEMBER OUTSTANDING REPORT (FIXED: Includes userId) ---

/**
 * Generates a summary report of total staked amount (outstanding value)
 * for all unsettled bets, grouped by the betting member.
 */
exports.getMemberOutstandingReport = async (req, res) => {
    try {
        const { allUserIds } = await getHierarchyIds(req.user._id);

        const outstandingReport = await BetSlip.aggregate([
            {
                // Filter for bets placed by the hierarchy members AND bets that are still 'pending'
                $match: {
                    user: { $in: allUserIds },
                    status: "pending",
                },
            },
            {
                // Lookup the user details (username/usercode)
                $lookup: {
                    from: "accounts",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDetails",
                    pipeline: [{ $project: { username: 1 } }],
                },
            },
            { $unwind: "$userDetails" },
            {
                // Group by the betting member (user ID) and sum the total stake
                $group: {
                    _id: "$user", // This remains the user's ObjectId
                    usercode: { $first: "$userDetails.username" },
                    totalOutstanding: { $sum: "$stake" },
                },
            },
            {
                // ADDED: userId for drill-down functionality
                $project: {
                    _id: 0,
                    userId: { $toString: "$_id" }, // Convert ObjectId to string for easy use in URL params
                    usercode: "$usercode",
                    totalOutstanding: "$totalOutstanding",
                },
            },
        ]);

        res.json({
            success: true,
            report: outstandingReport,
            message: "Member Outstanding Report generated.",
        });
    } catch (err) {
        console.error("Member Outstanding report error:", err);
        res.status(500).json({ error: "Internal Server Error." });
    }
};

// --- 2. MEMBER BET DETAIL REPORT (FIXED: Uses req.params and strict pending filter) ---
exports.getMemberBetDetailReport = async (req, res) => {
    try {
        // Read targetUserId from URL parameters (req.params) for specific user drill-down
        const { startDate, endDate, minAmount, maxAmount } = req.query;
        const targetUserId = req.params.targetUserId;

        if (!targetUserId) {
            return res.status(400).json({ error: "Target User ID is required for this report." });
        }

        let matchQuery = {
            // Filter strictly by the target user ID and pending status for the outstanding drill-down view
            user: new mongoose.Types.ObjectId(targetUserId),
            status: "pending",
        };

        if (startDate && endDate) {
            matchQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        // Add optional amount filters
        if (minAmount) {
            matchQuery.stake = { ...matchQuery.stake, $gte: parseFloat(minAmount) };
        }
        if (maxAmount) {
            matchQuery.stake = { ...matchQuery.stake, $lte: parseFloat(maxAmount) };
        }

        // --- Aggregation Pipeline ---
        const detailReport = await BetSlip.aggregate([
            { $match: matchQuery },

            // 1. Lookup User Details (for username)
            {
                $lookup: {
                    from: "accounts",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDetails",
                    pipeline: [{ $project: { username: 1 } }],
                },
            },
            { $unwind: "$userDetails" },

            // 2. Prepare Match IDs for lookup
            {
                $project: {
                    usercode: "$userDetails.username",
                    slipId: "$_id",
                    betType: 1,
                    stake: 1,
                    status: 1,
                    winLoss: "$profit",
                    date: "$createdAt",
                    // Extract match ID from the first leg for the Match lookup
                    matchId: {
                        $cond: {
                            if: { $eq: ["$betType", "single"] },
                            then: "$single.match",
                            else: { $arrayElemAt: ["$parlay.match", 0] },
                        },
                    },
                    legs: {
                        $cond: {
                            if: { $eq: ["$betType", "single"] },
                            then: ["$single"],
                            else: "$parlay",
                        },
                    },
                },
            },

            // 3. Lookup Match Details (Teams)
            {
                $lookup: {
                    from: "matches",
                    localField: "matchId",
                    foreignField: "apiMatchId",
                    as: "matchDetails",
                    pipeline: [{ $project: { homeTeam: 1, awayTeam: 1 } }],
                },
            },
            { $unwind: { path: "$matchDetails", preserveNullAndEmptyArrays: true } },

            // 4. Final Projection for UI Display
            {
                $project: {
                    slipId: { $toString: "$slipId" },
                    usercode: 1,
                    amount: "$stake",
                    status: 1,
                    winLoss: { $ifNull: ["$winLoss", 0] }, // Outstanding profit is usually 0 until settled
                    date: "$date",

                    matchName: {
                        $concat: [
                            { $ifNull: ["$matchDetails.homeTeam", "Unknown Home"] },
                            " Vs ",
                            { $ifNull: ["$matchDetails.awayTeam", "Unknown Away"] },
                        ],
                    },

                    detailSummary: {
                        $concat: ["$betType", " (", { $toString: { $size: "$legs" } }, " legs)"],
                    },
                },
            },
            { $sort: { date: -1 } },
        ]);

        res.json({
            success: true,
            report: detailReport,
            message: `Outstanding Bet Detail Report generated for user ${targetUserId}.`,
        });
    } catch (err) {
        console.error("Member Bet Detail Report error:", err);
        res.status(500).json({ error: "Internal Server Error." });
    }
};

// --- 3. ORIGINAL BODY/OU REPORT ---

/**
 * Generates a summary report of total staked amounts grouped by match,
 * period (Full Time/Half Time), and market (Home/Away/Over/Under).
 */
exports.generateBodyOuReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const { allUserIds } = await getHierarchyIds(req.user._id);

        const reportData = await BetSlip.aggregate([
            {
                $match: {
                    user: { $in: allUserIds },
                    status: { $in: ["won", "lost", "half-won", "half-lost", "push"] },
                    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
                },
            },
            {
                $project: {
                    stake: "$stake",
                    legs: {
                        $cond: {
                            if: { $eq: ["$betType", "single"] },
                            then: ["$single"],
                            else: "$parlay",
                        },
                    },
                },
            },
            { $unwind: "$legs" },
            {
                $match: {
                    "legs.betCategory": { $in: ["body", "overUnder"] },
                },
            },
            {
                $group: {
                    _id: {
                        match: "$legs.match",
                        period: "$legs.period",
                    },
                    homeStake: { $sum: { $cond: [{ $eq: ["$legs.market", "home"] }, "$stake", 0] } },
                    awayStake: { $sum: { $cond: [{ $eq: ["$legs.market", "away"] }, "$stake", 0] } },
                    overStake: { $sum: { $cond: [{ $eq: ["$legs.market", "over"] }, "$stake", 0] } },
                    underStake: { $sum: { $cond: [{ $eq: ["$legs.market", "under"] }, "$stake", 0] } },
                },
            },
            {
                $group: {
                    _id: "$_id.match",
                    HomeFT: { $sum: { $cond: [{ $eq: ["$_id.period", "full-time"] }, "$homeStake", 0] } },
                    AwayFT: { $sum: { $cond: [{ $eq: ["$_id.period", "full-time"] }, "$awayStake", 0] } },
                    OverFT: { $sum: { $cond: [{ $eq: ["$_id.period", "full-time"] }, "$overStake", 0] } },
                    UnderFT: { $sum: { $cond: [{ $eq: ["$_id.period", "full-time"] }, "$underStake", 0] } },
                    HomeHT: { $sum: { $cond: [{ $eq: ["$_id.period", "half-time"] }, "$homeStake", 0] } },
                    AwayHT: { $sum: { $cond: [{ $eq: ["$_id.period", "half-time"] }, "$awayStake", 0] } },
                    OverHT: { $sum: { $cond: [{ $eq: ["$_id.period", "half-time"] }, "$overStake", 0] } },
                    UnderHT: { $sum: { $cond: [{ $eq: ["$_id.period", "half-time"] }, "$underStake", 0] } },
                },
            },
            {
                $lookup: {
                    from: "matches",
                    localField: "_id",
                    foreignField: "apiMatchId",
                    as: "matchDetails",
                    pipeline: [{ $project: { homeTeam: 1, awayTeam: 1, startTime: 1 } }],
                },
            },
            {
                $unwind: {
                    path: "$matchDetails",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    matchId: "$_id",
                    match: {
                        $concat: [
                            { $ifNull: ["$matchDetails.homeTeam", "Unknown Home"] },
                            " Vs ",
                            { $ifNull: ["$matchDetails.awayTeam", "Unknown Away"] },
                        ],
                    },
                    date: { $ifNull: ["$matchDetails.startTime", null] },

                    FullTime: {
                        Home: "$HomeFT",
                        Away: "$AwayFT",
                        Over: "$OverFT",
                        Under: "$UnderFT",
                    },
                    HalfTime: {
                        Home: "$HomeHT",
                        Away: "$AwayHT",
                        Over: "$OverHT",
                        Under: "$UnderHT",
                    },
                },
            },
        ]);

        res.json({
            success: true,
            report: reportData,
            message: `Market Summary Report generated from BetSlips for matches between ${startDate} and ${endDate}.`,
        });
    } catch (err) {
        console.error("Body/OU Report generation error:", err);
        res.status(500).json({ error: "Internal Server Error during report generation." });
    }
};

// --- 4. MATCH STOCK DETAIL REPORT (NEW: Drill-down from Body/OU Report) ---

/**
 * Generates a drill-down list of bet slips for a specific match, period, and market category (Body or O/U).
 * This report is accessed by clicking the "Stock" total in the Body/OU summary report.
 */
exports.getMatchStockDetailReport = async (req, res) => {
    try {
        const { matchId, period } = req.params; // e.g., matchId=422668, period=full-time
        const { marketType } = req.query; // e.g., marketType=home, marketType=over

        if (!matchId || !period || !marketType) {
            return res.status(400).json({ error: "Match ID, period, and market type are required." });
        }

        const { allUserIds } = await getHierarchyIds(req.user._id);

        // 1. Set up the initial query for settled bets within the agent's hierarchy
        const matchQuery = {
            user: { $in: allUserIds },
            // Only settled bets are included in the Body/OU Stock report
            status: { $in: ["won", "lost", "half-won", "half-lost", "push"] },
        };

        const testData = await BetSlip.find(matchQuery).limit(5);
        console.log("Test Data Sample:", testData);

        // 2. Aggregation Pipeline to find specific legs
        const detailReport = await BetSlip.aggregate([
            { $match: matchQuery },

            // Project the legs array and the stake
            {
                $project: {
                    stake: "$stake",
                    user: "$user",
                    legs: {
                        $cond: {
                            if: { $eq: ["$betType", "single"] },
                            then: ["$single"],
                            else: "$parlay",
                        },
                    },
                    createdAt: 1,
                },
            },

            // Unwind to process each leg individually
            { $unwind: "$legs" },

            // Filter the legs based on the drill-down parameters
            {
                $match: {
                    "legs.match": matchId,
                    "legs.period": period,
                    "legs.market": marketType,
                    // Ensure we are only looking at Body or Over/Under category legs
                    "legs.betCategory": { $in: ["body", "overUnder"] },
                },
            },

            // 3. Lookup User Details (to get Usercode)
            {
                $lookup: {
                    from: "accounts",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDetails",
                    pipeline: [{ $project: { username: 1 } }],
                },
            },
            { $unwind: "$userDetails" },

            // 4. Lookup Match Details (to get teams and start time)
            {
                $lookup: {
                    from: "matches",
                    localField: "legs.match",
                    foreignField: "apiMatchId",
                    as: "matchDetails",
                    pipeline: [{ $project: { homeTeam: 1, awayTeam: 1, startTime: 1, league: 1 } }],
                },
            },
            { $unwind: "$matchDetails" },

            // 5. Final Projection to match the Stock Detail UI structure
            {
                $project: {
                    _id: 0,
                    slipId: { $toString: "$_id" }, // BetSlip ID
                    usercode: "$userDetails.username",
                    date: "$createdAt",
                    amount: "$stake",

                    // Create the Detail text: Line/Odds @ Period
                    detail: {
                        $concat: [
                            "$legs.line",
                            " @ ",
                            { $toString: "$legs.odds" },
                            " (",
                            "$legs.market", // e.g., home, over
                            ") @ ",
                            "$legs.period", // e.g., full-time
                        ],
                    },

                    // Include match info for the header
                    matchInfo: {
                        homeTeam: "$matchDetails.homeTeam",
                        awayTeam: "$matchDetails.awayTeam",
                        startTime: "$matchDetails.startTime",
                        league: "$matchDetails.league",
                        period: "$legs.period",
                    },

                    // Grouping key for client-side sorting (Lazio/AC Milan, Over/Under)
                    groupKey: "$legs.market",
                },
            },
            { $sort: { date: 1 } },
        ]);

        // Structure the output to separate the results for Home/Away or Over/Under on the client side
        const groupedReport = {
            matchInfo: detailReport.length > 0 ? detailReport[0].matchInfo : null,
            // Filter the results into the two categories
            primaryMarket: detailReport.filter((item) => ["home", "over"].includes(item.groupKey)),
            secondaryMarket: detailReport.filter((item) => ["away", "under"].includes(item.groupKey)),
        };
        console.log(groupedReport);

        res.json({
            success: true,
            report: groupedReport,
            message: `Stock Detail Report generated for Match: ${matchId}, Period: ${period}, Market: ${marketType}.`,
        });
    } catch (err) {
        console.error("Match Stock Detail Report error:", err);
        res.status(500).json({ error: "Internal Server Error." });
    }
};
