const BetSlip = require("../models/betSlipModel");
const Match = require("../models/matchModel");
const mongoose = require("mongoose");
const betCalculator = require("../utils/betCalculator");
const commissionService = require("./commissionService");
const balanceService = require("./balanceService");

exports.processSettlement = async (finishedMatchIds) => {
    if (!finishedMatchIds.length) return [];

    console.log(`[SETTLEMENT] Starting settlement for ${finishedMatchIds.length} matches.`);

    // 1️⃣ Load completed match scores
    const completedMatches = await Match.find({
        _id: { $in: finishedMatchIds },
    }).lean();

    const matchDataMap = new Map();
    completedMatches.forEach((match) => {
        matchDataMap.set(match._id.toString(), {
            full_time: match.scores.full_time,
            half_time: match.scores.live,
        });
    });

    // 2️⃣ Find pending slips
    const pendingSlips = await BetSlip.find({
        status: "pending",
        "legs.match": { $in: finishedMatchIds },
    }).populate({
        path: "user",
        select: "upline username",
    });

    const settledSlips = [];

    for (const slip of pendingSlips) {
        let canSettle = true;

        // 3️⃣ Settle each leg
        for (const leg of slip.legs) {
            if (leg.outcome !== "unsettled") continue;

            const scoreData = matchDataMap.get(leg.match.toString());
            if (!scoreData) {
                canSettle = false;
                break;
            }

            const score = leg.period === "full-time" ? scoreData.full_time : scoreData.half_time;

            if (!score || score.home === undefined) {
                canSettle = false;
                break;
            }

            const { outcome, cashDelta } = betCalculator.calculateLegOutcome(slip.betSystem, leg, score, slip.stake);
            console.log(outcome, cashDelta);

            leg.outcome = outcome;
            leg.cashDelta = cashDelta;
        }

        // 4️⃣ Finalize slip if all legs settled
        if (!canSettle || slip.legs.some((l) => l.outcome === "unsettled")) {
            console.warn(`[SETTLEMENT] Skipping slip ${slip._id}. Incomplete data.`);
            continue;
        }

        const finalResult = betCalculator.finalizeSlipSettlement(slip);

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // A️⃣ Update BetSlip
            slip.status = finalResult.status;
            slip.payout = finalResult.payout;
            slip.profit = finalResult.profit;
            slip.conditions = "paidout";
            slip.settledAt = new Date();

            await slip.save({ session });

            // B️⃣ Credit user balance
            if (slip.payout > 0) {
                await balanceService.creditPayout(slip.user._id, slip.payout, session);

                console.log(`[SETTLEMENT] Credited ${slip.user.username} with Payout: ${slip.payout}`);
            }

            // C️⃣ Commission
            await commissionService.processCommissionDistribution(session, slip);

            await session.commitTransaction();
            session.endSession();

            settledSlips.push(slip);
            console.log(`[SETTLEMENT] Completed Slip ${slip._id}`);
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error(`[SETTLEMENT] Failed for Slip ${slip._id}:`, err.message);
        }
    }

    return settledSlips;
};
