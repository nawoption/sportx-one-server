const BetSlip = require("../models/betSlipModel");
const Match = require("../models/matchModel");
const Balance = require("../models/balanceModel");
const mongoose = require("mongoose");
const betCalculator = require("../utils/betCalculator");

/**
 * Finds all BetSlips that are pending settlement for a list of finished matches
 * and updates their status and payout, handling financial transactions.
 * * @param {Array<string>} finishedMatchIds - Array of apiMatchIds that have completed.
 */
exports.processSettlement = async (finishedMatchIds) => {
    if (finishedMatchIds.length === 0) {
        console.log("No finished matches to settle.");
        return;
    }

    // 1. Fetch all completed match data required for calculation (Same as before)
    const completedMatches = await Match.find({
        apiMatchId: { $in: finishedMatchIds },
    }).lean();

    const matchDataMap = new Map();
    completedMatches.forEach((match) => {
        matchDataMap.set(match.apiMatchId, {
            full_time: match.scores.full_time,
            half_time: match.scores.live,
        });
    });

    // 2. Find all pending bet slips that contain any of these match IDs (Same as before)
    const pendingSlips = await BetSlip.find({
        status: "pending",
        "legs.match": { $in: finishedMatchIds },
    });

    const settledSlips = [];

    for (const slip of pendingSlips) {
        // --- 3. Settle Legs and Calculate Final Results ---
        let needsSettlement = true;
        slip.legs.forEach((leg) => {
            if (leg.outcome !== "pending") return;

            const matchScoreData = matchDataMap.get(leg.match);
            if (matchScoreData) {
                let score = leg.period === "full-time" ? matchScoreData.full_time : matchScoreData.half_time;

                if (score && score.home !== undefined) {
                    const { outcome, multiplier } = betCalculator.calculateLegOutcome(leg, score);
                    leg.outcome = outcome;
                    leg.payoutMultiplier = multiplier;
                } else {
                    needsSettlement = false;
                }
            } else {
                needsSettlement = false;
            }
        });

        // --- 4. Finalize BetSlip and Execute Financial Transaction ---
        if (needsSettlement && slip.legs.every((leg) => leg.outcome !== "pending")) {
            const finalResults = betCalculator.finalizeSlipSettlement(slip);

            // Start a new session and transaction for the financial update
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                // Update the slip status and financial data
                slip.status = finalResults.status;
                slip.profit = finalResults.profit;
                slip.payout = finalResults.payout;
                slip.conditions = "paidout";
                slip.settledAt = new Date();

                // Save BetSlip update within the transaction
                await slip.save({ session });

                // Credit User Account Balance if Won/Half-Won/Push
                if (slip.payout > 0) {
                    const userBalance = await Balance.findOne({ account: slip.user }).session(session);

                    if (userBalance) {
                        // Increase the user's cashBalance and accountBalance by the calculated Payout amount
                        userBalance.cashBalance += slip.payout;
                        userBalance.accountBalance += slip.payout;

                        // Save balance update within the transaction
                        await userBalance.save({ session });
                        console.log(
                            `[SETTLEMENT] Credited ${slip.user} with Payout: ${slip.payout}. Slip ID: ${slip._id}`
                        );
                    } else {
                        throw new Error(`Balance document not found for user: ${slip.user}`);
                    }
                } else {
                    console.log(`[SETTLEMENT] Slip ${slip._id} settled as ${slip.status}. No payout needed.`);
                }

                // Commit the transaction (Both BetSlip and Balance are updated)
                await session.commitTransaction();
                settledSlips.push(slip);
            } catch (transactionError) {
                // If anything fails (DB save, Balance update, etc.), abort the transaction
                await session.abortTransaction();
                console.error(`[SETTLEMENT] Transaction failed for BetSlip ${slip._id}:`, transactionError.message);
                // The slip status remains 'pending', and it will be re-attempted in the next cron run
            } finally {
                session.endSession();
            }
        }
    }

    return settledSlips;
};
