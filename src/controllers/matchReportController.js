const BetSlip = require("../models/betSlipModel");
const Match = require("../models/matchModel");
const downlineService = require("../services/downlineService");
const mongoose = require("mongoose");

// --- UTILITY FUNCTIONS ---

/**
 * Common logic to get the logged-in user's ID and all downline IDs.
 * @param {string} userId - The ID of the logged-in user.
 * @returns {Promise<{loggedInObjectId: mongoose.Types.ObjectId, allUserIds: mongoose.Types.ObjectId[]}>}
 */
const getHierarchyIds = async (userId) => {
    if (!userId) {
        throw new Error("User ID is required for hierarchy query.");
    }
    const loggedInObjectId = new mongoose.Types.ObjectId(userId);
    const downlineIds = await downlineService.getAllDownlineIds(userId);
    const allUserIds = [loggedInObjectId, ...downlineIds];
    return { loggedInObjectId, allUserIds };
};

// --- 1. MEMBER OUTSTANDING REPORT ---

exports.getMemberOutstandingReport = async (req, res) => {
    try {
        const { allUserIds } = await getHierarchyIds(req.user._id);

        const outstandingReport = await BetSlip.aggregate([
            {
                $match: {
                    user: { $in: allUserIds },
                    status: "pending",
                },
            },
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
            {
                $group: {
                    _id: "$user",
                    usercode: { $first: "$userDetails.username" },
                    totalOutstanding: { $sum: "$stake" },
                },
            },
            {
                $project: {
                    _id: 0,
                    userId: { $toString: "$_id" },
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

// --- 2. MEMBER BET DETAIL REPORT (UPDATED FIELD NAMES) ---

exports.getMemberBetDetailReport = async (req, res) => {
    try {
        const { startDate, endDate, minAmount, maxAmount } = req.query;
        const targetUserId = req.params.targetUserId;

        if (!targetUserId) {
            return res.status(400).json({ error: "Target User ID is required for this report." });
        }

        let matchQuery = {
            user: new mongoose.Types.ObjectId(targetUserId),
            status: "pending",
        };

        if (startDate && endDate) {
            matchQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        if (minAmount) {
            matchQuery.stake = { ...matchQuery.stake, $gte: parseFloat(minAmount) };
        }
        if (maxAmount) {
            matchQuery.stake = { ...matchQuery.stake, $lte: parseFloat(maxAmount) };
        }

        // --- Aggregation Pipeline ---
        const detailReport = await BetSlip.aggregate([
            { $match: matchQuery },

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

            {
                $project: {
                    usercode: "$userDetails.username",
                    slipId: "$_id",
                    betType: 1,
                    stake: 1,
                    status: 1,
                    winLoss: "$profit",
                    date: "$createdAt",
                    legs: "$legs",
                    // Extract the Match ObjectId from the first leg
                    matchObjectId: { $arrayElemAt: ["$legs.match", 0] },
                },
            },

            {
                $lookup: {
                    from: "matches",
                    localField: "matchObjectId",
                    foreignField: "_id",
                    as: "matchDetails",
                    // Request specific team fields
                    pipeline: [{ $project: { homeTeam: 1, awayTeam: 1 } }],
                },
            },
            { $unwind: { path: "$matchDetails", preserveNullAndEmptyArrays: true } },

            {
                $project: {
                    slipId: { $toString: "$slipId" },
                    usercode: 1,
                    amount: "$stake",
                    status: 1,
                    winLoss: { $ifNull: ["$winLoss", 0] },
                    date: "$date",

                    // --- FIX: Use homeTeam/awayTeam directly ---
                    matchName: {
                        $cond: {
                            if: { $ne: ["$matchDetails", null] },
                            then: {
                                $concat: [
                                    { $ifNull: ["$matchDetails.homeTeam", "Unknown Home"] },
                                    " Vs ",
                                    { $ifNull: ["$matchDetails.awayTeam", "Unknown Away"] },
                                ],
                            },
                            else: "Unknown Home Vs Unknown Away",
                        },
                    },
                    // ------------------------------------------

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

// --- 3. GENERATE BODY/OU REPORT (FIXED: SAFER MATCH NAME CONCATENATION & FIELDS) ---

exports.generateBodyOuReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const { allUserIds } = await getHierarchyIds(req.user._id);

        const reportData = await BetSlip.aggregate([
            {
                $match: {
                    user: { $in: allUserIds },
                    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
                },
            },
            {
                $project: {
                    stake: 1,
                    legs: 1,
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
                        match: "$legs.match", // Match ObjectId
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
                    _id: "$_id.match", // Match ObjectId
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
            // Lookup Match Details using the Match ObjectId (_id from the Match collection)
            {
                $lookup: {
                    from: "matches",
                    localField: "_id",
                    foreignField: "_id",
                    as: "matchDetails",
                    // Request specific team fields
                    pipeline: [{ $project: { homeTeam: 1, awayTeam: 1, startTime: 1, apiMatchId: 1 } }],
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
                    matchObjectId: "$_id",
                    matchId: "$matchDetails.apiMatchId",

                    // --- FIX: Use homeTeam/awayTeam directly in safe $cond ---
                    match: {
                        $cond: {
                            if: { $ne: ["$matchDetails", null] },
                            then: {
                                $concat: [
                                    { $ifNull: ["$matchDetails.homeTeam", "Unknown Home"] },
                                    " Vs ",
                                    { $ifNull: ["$matchDetails.awayTeam", "Unknown Away"] },
                                ],
                            },
                            else: "Unknown Home Vs Unknown Away",
                        },
                    },
                    // --------------------------------------------------------

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

// --- 4. MATCH STOCK DETAIL REPORT (UPDATED FIELD NAMES) ---

exports.getMatchStockDetailReport = async (req, res) => {
    try {
        const { matchId, period } = req.params;
        const { marketType } = req.query;

        if (!matchId || !period || !marketType) {
            return res.status(400).json({ error: "Match ID, period, and market type are required." });
        }

        const { allUserIds } = await getHierarchyIds(req.user._id);

        // Find match ObjectId using API ID
        const matchDoc = await Match.findOne({ apiMatchId: matchId }).select("_id homeTeam awayTeam league").lean();

        if (!matchDoc) {
            return res.status(404).json({ error: "Match not found in database." });
        }

        const matchObjectId = matchDoc._id;

        const matchQuery = {
            user: { $in: allUserIds },
            status: { $in: ["pending", "won", "lost", "half-won", "half-lost", "push"] },
            "legs.match": matchObjectId,
        };

        const detailReport = await BetSlip.aggregate([
            { $match: matchQuery },

            {
                $project: {
                    stake: 1,
                    user: 1,
                    legs: 1,
                    createdAt: 1,
                },
            },

            { $unwind: "$legs" },

            {
                $match: {
                    "legs.match": matchObjectId,
                    "legs.period": period,
                    "legs.market": marketType,
                    "legs.betCategory": { $in: ["body", "overUnder"] },
                },
            },

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

            // Lookup Match Details again to ensure we get the latest data if needed
            {
                $lookup: {
                    from: "matches",
                    localField: "legs.match",
                    foreignField: "_id",
                    as: "matchDetails",
                    // Request specific team fields
                    pipeline: [{ $project: { homeTeam: 1, awayTeam: 1, startTime: 1, league: 1 } }],
                },
            },
            { $unwind: "$matchDetails" },

            // 5. Final Projection
            {
                $project: {
                    _id: 0,
                    slipId: { $toString: "$_id" },
                    usercode: "$userDetails.username",
                    date: "$createdAt",
                    amount: "$stake",

                    detail: {
                        $concat: [
                            "$legs.line",
                            " @ ",
                            { $toString: "$legs.odds" },
                            " (",
                            "$legs.market",
                            ") @ ",
                            "$legs.period",
                        ],
                    },

                    // --- FIX: Use homeTeam/awayTeam and league fields ---
                    matchInfo: {
                        homeTeam: "$matchDetails.homeTeam",
                        awayTeam: "$matchDetails.awayTeam",
                        startTime: "$matchDetails.startTime",
                        league: "$matchDetails.league",
                        period: "$legs.period",
                    },
                    // ----------------------------------------------------

                    groupKey: "$legs.market",
                },
            },
            { $sort: { date: 1 } },
        ]);

        const groupedReport = {
            matchInfo: detailReport.length > 0 ? detailReport[0].matchInfo : null,
            primaryMarket: detailReport.filter((item) => ["home", "over"].includes(item.groupKey)),
            secondaryMarket: detailReport.filter((item) => ["away", "under"].includes(item.groupKey)),
        };

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
