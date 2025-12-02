const BetSlip = require("../models/betslipModel");
const betController = require("../controllers/betController");
// const resultsApi = require('./externalResultsApi'); // Module for external API integration

/**
 * 💡 NOTE: In a production environment, this function would call an external
 * sports API to fetch the final scores for recently finished matches.
 * We use mock data here for demonstration.
 */
const getRecentMatchResults = async () => {
    // Mocking final scores for demonstration purposes:
    return {
        "GER-101": { homeScore: 2, awayScore: 1 }, // Example Win
        "FRA-205": { homeScore: 0, awayScore: 0 }, // Example Push/Draw
    };
};

exports.runSettlementJob = async () => {
    console.log("--- Starting Automated Settlement Job ---");

    // 1. Get results for recently finished matches.
    const matchResultsMap = await getRecentMatchResults();
    const finishedMatchIds = Object.keys(matchResultsMap);

    if (finishedMatchIds.length === 0) {
        return console.log("No new match results to process.");
    }

    // 2. Find all PENDING bets referencing these finished matches.
    const pendingBets = await BetSlip.find({
        status: "pending",
        $or: [{ "single.match": { $in: finishedMatchIds } }, { "parlay.match": { $in: finishedMatchIds } }],
    }).lean();

    console.log(`Found ${pendingBets.length} pending bets to settle.`);

    // 3. Process each bet by simulating the necessary Express objects
    const processingPromises = pendingBets.map(async (bet) => {
        try {
            // Define a simple mock request object for the controller
            const mockReq = {
                params: { slipId: bet.slipId },
                body: { matchResults: matchResultsMap },
            };

            // Define a mock response object to prevent errors when controller calls res.status().json()
            const mockRes = {
                statusCode: 200,
                // Mock .status() function to return itself for chaining: res.status(200).json(...)
                status: function (code) {
                    this.statusCode = code;
                    return this;
                },
                // Mock .json() function to log the controller's output (error or success)
                json: function (data) {
                    if (this.statusCode >= 400) {
                        console.error(`Error settling ${bet.slipId} (Status ${this.statusCode}):`, data);
                    }
                    // Return data to finish the promise chain
                    return data;
                },
            };

            // Call the existing settlement logic using the mock objects
            await betController.settleBet(mockReq, mockRes);

            console.log(`Successfully settled slip: ${bet.slipId}`);
            return { slipId: bet.slipId, status: "Settled" };
        } catch (error) {
            console.error(`CRITICAL FAILURE for slip ${bet.slipId}:`, error.message);
            // In a production app, you might update the status to 'manual_review' here
            return { slipId: bet.slipId, status: "Failed" };
        }
    });

    await Promise.all(processingPromises);
    console.log("--- Settlement Job Finished ---");
};
