const cron = require("node-cron");
const Match = require("../models/matchModel");
const settlementService = require("../services/settlementService");

const startSettlementJob = () => {
    cron.schedule(
        "* * * * *",
        async () => {
            console.log(`[SETTLEMENT CRON] Checking for completed matches at ${new Date().toISOString()}`);

            try {
                const completedMatches = await Match.find({
                    status: "completed",
                    // matchSettled: { $ne: true } // *Is recommended for production*
                }).select("apiMatchId");

                if (completedMatches.length === 0) {
                    console.log("[SETTLEMENT CRON] No new completed matches found.");
                    return;
                }

                const finishedMatchIds = completedMatches.map((m) => m._id);

                // 2. Process settlement for these matches
                const settledSlips = await settlementService.processSettlement(finishedMatchIds);

                console.log(`[SETTLEMENT CRON] Successfully settled ${settledSlips.length} BetSlips.`);

                // 3. Optionally, mark matches as settled to avoid reprocessing
                // await Match.updateMany(
                //     { _id: { $in: finishedMatchIds } },
                //     { $set: { matchSettled: true } }
                // );
            } catch (error) {
                console.error("[SETTLEMENT CRON] Fatal error during settlement process:", error);
            }
        },
        {
            scheduled: true,
            timezone: "Asia/Yangon",
        }
    );

    console.log("Bet Settlement Cron Job started. Runs every 1 minute (MMT).");
};

module.exports = { startSettlementJob };
