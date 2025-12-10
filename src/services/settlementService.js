const BetSlip = require("../models/betSlipModel");
const Match = require("../models/matchModel");
const Balance = require("../models/balanceModel");
const mongoose = require("mongoose");
const betCalculator = require("../utils/betCalculator");
const commissionService = require("./commissionService");

/**
 * Finds all BetSlips that are pending settlement for a list of finished matches
 * and updates their status and payout, handling financial transactions and commissions.
 * * @param {Array<string>} finishedMatchIds - Array of apiMatchIds that have completed.
 */
exports.processSettlement = async (finishedMatchIds) => {
    if (finishedMatchIds.length === 0) {
        console.log("No finished matches to settle.");
        return [];
    }

    console.log(`[SETTLEMENT] Starting settlement for ${finishedMatchIds.length} matches.`);

    // 1. Fetch all completed match data required for calculation
    const completedMatches = await Match.find({
        apiMatchId: { $in: finishedMatchIds },
    }).lean();

    const matchDataMap = new Map();
    completedMatches.forEach((match) => {
        // Map: apiMatchId -> { full_time, half_time } scores
        matchDataMap.set(match.apiMatchId, {
            full_time: match.scores.full_time,
            half_time: match.scores.live, // Assuming 'live' contains the half-time score
        });
    });

    // 2. Find all pending bet slips that contain any of these match IDs
    const pendingSlips = await BetSlip.find({
        status: "pending",
        "legs.match": { $in: finishedMatchIds },
    }).populate({
        path: "user",
        select: "upline username",
    });

    const settledSlips = [];

    for (const slip of pendingSlips) {
        // --- 3. Settle Legs and Calculate Final Results ---
        let needsSettlement = true;
        // Check if all legs can be settled
        for (const leg of slip.legs) {
            if (leg.outcome !== "pending") continue;

            const matchScoreData = matchDataMap.get(leg.match);
            if (!matchScoreData) {
                needsSettlement = false;
                break;
            }

            const score = leg.period === "full-time" ? matchScoreData.full_time : matchScoreData.half_time;

            if (score && score.home !== undefined) {
                const { outcome, multiplier } = betCalculator.calculateLegOutcome(leg, score);
                leg.outcome = outcome;
                leg.payoutMultiplier = multiplier;
            } else {
                needsSettlement = false;
                break;
            }
        }

        // --- 4. Finalize BetSlip and Execute Transaction (Payout & Commission) ---
        if (needsSettlement && slip.legs.every((leg) => leg.outcome !== "pending")) {
            const finalResults = betCalculator.finalizeSlipSettlement(slip);

            // Start a new session and transaction for atomicity
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                // A. Update the slip status and financial data
                slip.status = finalResults.status;
                slip.profit = finalResults.profit;
                slip.payout = finalResults.payout;
                slip.conditions = "paidout"; // Standardized condition
                slip.settledAt = new Date();

                // Save BetSlip update within the transaction
                await slip.save({ session });

                // B. Credit User Account Balance if Won/Half-Won/Push
                if (slip.payout > 0) {
                    const userBalance = await Balance.findOne({ account: slip.user._id }).session(session);

                    if (userBalance) {
                        userBalance.cashBalance += slip.payout;
                        userBalance.accountBalance += slip.payout;
                        await userBalance.save({ session });
                        console.log(`[SETTLEMENT] Credited ${slip.user.username} with Payout: ${slip.payout}.`);
                    } else {
                        throw new Error(`Balance document not found for user: ${slip.user._id}`);
                    }
                } else {
                    console.log(`[SETTLEMENT] Slip ${slip._id} settled as ${slip.status}. No payout needed.`);
                }

                // C. Commission Distribution
                await commissionService.processCommissionDistribution(session, slip);

                // Commit the transaction (BetSlip, Balance, and CommissionTransactions are all saved)
                await session.commitTransaction();
                settledSlips.push(slip);
                console.log(`[SETTLEMENT] Transaction complete for Slip ID: ${slip._id}`);
            } catch (transactionError) {
                // If anything fails (DB save, Balance update, Commission insert, etc.), abort the transaction
                await session.abortTransaction();
                console.error(`[SETTLEMENT] Transaction failed for BetSlip ${slip._id}:`, transactionError.message);
            } finally {
                session.endSession();
            }
        } else {
            // Log if a slip cannot be settled due to missing score data (should be rare)
            console.warn(`[SETTLEMENT] Skipping slip ${slip._id}. Not all legs could be settled.`);
        }
    }

    return settledSlips;
};
