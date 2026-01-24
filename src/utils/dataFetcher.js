const cron = require("node-cron");
const axios = require("axios");
const matchService = require("../services/matchService");
const config = require("../config");

const API_KEY = config.env.ODDS_API_KEY;
const BASE_URL = config.env.ODDS_API_URL;

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
        const moungResponse = await axios.get(`${BASE_URL}/?api_key=${API_KEY}`);
        if (Array.isArray(moungResponse.data.data)) {
            await processMatches(moungResponse.data.data);
            console.log(`[CRON] Successfully processed ${moungResponse.data.data.length} Moung matches.`);
        }
    } catch (error) {
        console.error("[CRON] Error fetching Moung data:", error.message);
    }

    // // 4. Fetch Results Data (Final Status and Scores)
    // try {
    //     const resultsResponse = await axios.get(`${BASE_URL}/results?key=${API_KEY}`);
    //     if (Array.isArray(resultsResponse.data.data)) {
    //         await processMatches(resultsResponse.data.data);
    //         console.log(`[CRON] Successfully processed ${resultsResponse.data.data.length} Result matches.`);
    //     }
    // } catch (error) {
    //     console.error("[CRON] Error fetching Results data:", error.message);
    // }

    console.log(`[CRON] Data fetch job finished.`);
};

const startCronJob = () => {
    cron.schedule(config.env.CORN_SCHEDULE_FETCH_MATCHES, fetchAndSaveAllData, {
        scheduled: true,
        timezone: config.env.TIMEZONE,
    });

    console.log("Cron Job for external match data fetching started. Runs every 5 minutes (MMT).");

    fetchAndSaveAllData();
};

module.exports = { startCronJob, fetchAndSaveAllData };
