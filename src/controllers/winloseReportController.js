const BetSlip = require("../models/betSlipModel");
const CommissionTransaction = require("../models/commissionTransactionModel");
const Account = require("../models/accountModel");
const mongoose = require("mongoose");
const downlineService = require("../services/downlineService");

// --- UTILITY FUNCTIONS ---
/**
 * Common logic to get the logged-in user's ID and all downline IDs.
 */
const getHierarchyIds = async (userId) => {
    const loggedInObjectId = new mongoose.Types.ObjectId(userId);
    const downlineIds = await downlineService.getAllDownlineIds(userId);
    const allUserIds = [loggedInObjectId, ...downlineIds];
    return { loggedInObjectId, allUserIds };
};

// --- Report Generation ---

exports.generateWinLoseReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const loggedInUserId = req.user._id;
        // Use the logged-in user's ID string for easier comparison later
        const loggedInUserIdStr = loggedInUserId.toString();

        // Get all users in the hierarchy below the logged-in user (including themselves if they bet)
        const { allUserIds } = await getHierarchyIds(loggedInUserId);

        const matchDate = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
        };

        // 1. Get ALL settled BetSlips for the relevant users
        const betSlips = await BetSlip.aggregate([
            {
                $match: {
                    user: { $in: allUserIds },
                    status: { $in: ["won", "lost", "half-won", "half-lost", "push", "cancelled"] },
                    settledAt: matchDate,
                },
            },
            {
                $project: {
                    _id: 1,
                    user: 1,
                    stake: 1,
                    profit: 1, // Net profit from the bet (User W/L)
                },
            },
            // Lookup the betting user's details, including upline
            {
                $lookup: {
                    from: "accounts",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDetails",
                    pipeline: [{ $project: { upline: 1, username: 1 } }],
                },
            },
            { $unwind: "$userDetails" },
        ]);

        const slipIds = betSlips.map((s) => s._id);

        // 2. Get ALL commission transactions related to these settled slips
        const commissions = await CommissionTransaction.find({
            betSlip: { $in: slipIds },
        }).lean();

        // --- Data Aggregation and Structuring ---

        // Map for detailed user reports (Key: userId of the betting user)
        const reportDataMap = new Map();

        // Helper to initialize user data structure
        const initUserReport = (userId, username, uplineId) => ({
            userId: userId.toString(),
            username: username,
            uplineId: uplineId ? uplineId.toString() : null,
            totalStake: 0,

            // Logged-in Agent's View (Profit from this user's bets)
            Agent_WL: 0, // Set to 0 as per example, agents typically earn commission not WL
            Agent_Comm: 0, // Commission RECEIVED by the logged-in agent from this user's slips
            Agent_Total: 0,

            // Member View (Betting User's P/L)
            Member_WL: 0, // slip.profit
            Member_Comm: 0, // Always 0 for the betting member
            Member_Total: 0,

            // Company/System View (Overall P/L from this user's bets)
            Company_WL: 0, // -slip.profit (Company's P/L before commission deduction)
            Company_Comm: 0, // Total commission paid out by the system for this user's slips
            Company_Total: 0,
        });

        // Map to quickly link slipId to betting userId
        const slipOwnerMap = new Map();
        betSlips.forEach((slip) => slipOwnerMap.set(slip._id.toString(), slip.user.toString()));

        // A. Process BetSlips (W/L and Stake)
        betSlips.forEach((slip) => {
            const userId = slip.user.toString();
            const uplineId = slip.userDetails.upline ? slip.userDetails.upline.toString() : null;

            if (!reportDataMap.has(userId)) {
                reportDataMap.set(userId, initUserReport(slip.user, slip.userDetails.username, uplineId));
            }
            const data = reportDataMap.get(userId);

            data.totalStake += slip.stake;

            // Member W/L is the user's net profit/loss
            data.Member_WL += slip.profit;

            // Company W/L is the mirror image of the user's profit/loss (Company's P/L before commission)
            const companyProfitLoss = -slip.profit;
            data.Company_WL += companyProfitLoss;
        });

        // B. Process Commissions
        commissions.forEach((comm) => {
            const recipientId = comm.user.toString();
            const bettingUserId = slipOwnerMap.get(comm.betSlip.toString());

            if (!bettingUserId || !reportDataMap.has(bettingUserId)) return;
            const data = reportDataMap.get(bettingUserId);

            // 1. Update Company Commission: Total commission paid out by the system for this bet
            data.Company_Comm += comm.amount;

            // 2. Update Agent Commission: Commission RECEIVED by the logged-in user
            if (recipientId === loggedInUserIdStr) {
                data.Agent_Comm += comm.amount;
            }
        });

        // C. Calculate Final Totals (Agent, Member, Company)
        const finalReport = Array.from(reportDataMap.values()).map((data) => {
            // Member Totals (Member Comm is usually 0)
            data.Member_Total = data.Member_WL + data.Member_Comm;

            // Company Totals (W/L minus ALL commissions paid out)
            data.Company_Total = data.Company_WL - data.Company_Comm;

            // Agent Totals (Agent W/L is assumed 0, profit comes from commission received)
            data.Agent_Total = data.Agent_WL + data.Agent_Comm;

            return {
                Usercode: data.username,
                Amount: data.totalStake,

                // Logged-in Agent's View
                Agent_WL: data.Agent_WL,
                Agent_Comm: data.Agent_Comm,
                Agent_Total: data.Agent_Total,

                // Member View
                Member_WL: data.Member_WL,
                Member_Comm: data.Member_Comm,
                Member_Total: data.Member_Total,

                // Company View
                Company_WL: data.Company_WL,
                Company_Comm: data.Company_Comm,
                Company_Total: data.Company_Total,
            };
        });

        res.json({
            success: true,
            report: finalReport,
            message: `Multi-Perspective Report generated for ${startDate} to ${endDate}.`,
        });
    } catch (err) {
        console.error("Win/Lose Report generation error:", err);
        res.status(500).json({ error: "Internal Server Error." });
    }
};
