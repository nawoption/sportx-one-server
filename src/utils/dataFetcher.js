const cron = require("node-cron");
const axios = require("axios");
const matchService = require("../services/matchService");

const API_KEY = "demoapi";
const BASE_URL = "https://htayapi.com/mmk-autokyay/v3";

const processMatches = async (apiMatches) => {
    if (!apiMatches || apiMatches.length === 0) return;

    for (const match of apiMatches) {
        try {
            await matchService.upsertMatch(match);
        } catch (error) {
            console.error(`[DataFetcher] Error processing match ${match.id}:`, error.message);
        }
    }
};

const fetchAndSaveAllData = async () => {
    console.log(`[CRON] Starting data fetch job at ${new Date().toISOString()}`);

    // --- API Endpoints and Corresponding Status/Data Type ---

    // 1. Fetch Moung Data (Pre-match Main Odds)
    try {
        const moungResponse = await axios.get(`${BASE_URL}/moung?key=${API_KEY}`);
        if (Array.isArray(moungResponse.data.data)) {
            await processMatches(moungResponse.data.data);
            console.log(`[CRON] Successfully processed ${moungResponse.data.data.length} Moung matches.`);
        }
    } catch (error) {
        console.error("[CRON] Error fetching Moung data:", error.message);
    }

    // 2. Fetch Body/OU Data (Detailed Odds Updates)
    // try {
    //     const bodyOuResponse = await axios.get(`${BASE_URL}/body-goalboung?key=${API_KEY}`);
    //     if (Array.isArray(bodyOuResponse.data.data)) {
    //         await processMatches(bodyOuResponse.data.data);
    //         console.log(`[CRON] Successfully processed ${bodyOuResponse.data.data.length} Body/OU matches.`);
    //     }
    // } catch (error) {
    //     console.error("[CRON] Error fetching Body/OU data:", error.message);
    // }

    // 3. Fetch Live Data (Scores and Live Odds - Should run frequently, e.g., every 60 seconds)
    // try {
    //     const liveResponse = await axios.get(`${BASE_URL}/live?key=${API_KEY}`);
    //     if ( Array.isArray(liveResponse.data.data)) {
    //         await processMatches(liveResponse.data.data);
    //         console.log(`[CRON] Successfully processed ${liveResponse.data.data.length} Live matches.`);
    //     }
    // } catch (error) {
    //     console.error("[CRON] Error fetching Live data:", error.message);
    // }

    // 4. Fetch Results Data (Final Status and Scores)
    try {
        const resultsResponse = await axios.get(`${BASE_URL}/results?key=${API_KEY}`);
        if (Array.isArray(resultsResponse.data.data)) {
            await processMatches(resultsResponse.data.data);
            console.log(`[CRON] Successfully processed ${resultsResponse.data.data.length} Result matches.`);
        }
    } catch (error) {
        console.error("[CRON] Error fetching Results data:", error.message);
    }

    console.log(`[CRON] Data fetch job finished.`);
};

const startCronJob = () => {
    cron.schedule("*/5 * * * *", fetchAndSaveAllData, {
        scheduled: true,
        timezone: "Asia/Yangon", // Myanmar Timezone
    });

    console.log("Cron Job for external match data fetching started. Runs every 5 minutes (MMT).");

    fetchAndSaveAllData();
};

module.exports = { startCronJob, fetchAndSaveAllData };
