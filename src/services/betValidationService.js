const Match = require("../models/matchModel");

/**
 * Fetches current odds for all bet legs and automatically injects the official line and odds
 * from the live Match data into the leg objects.
 *
 * @param {Array<Object>} legs - The array of bet leg objects submitted by the user (MISSING line and odds).
 * @returns {Promise<{validatedLegs: Array<Object>, totalOdds: number}>} - The total odds and the fully structured leg objects.
 * @throws {Error} - Throws an error if any match is invalid, finished, or if betting parameters are invalid.
 */
exports.validateAndCalculateOdds = async (legs) => {
    // 1. Fetch live match data
    const matchIds = legs.map((leg) => leg.match);

    const liveMatches = await Match.find({
        _id: { $in: matchIds },
        status: { $ne: "completed" }, // Ensure betting is still open
    })
        .select("odds status")
        .lean();

    if (liveMatches.length !== matchIds.length) {
        throw new Error("One or more matches are not found or betting has closed.");
    }

    const matchOddsMap = new Map(liveMatches.map((m) => [m._id.toString(), m.odds]));
    let totalOdds = 1;
    let validatedLegs = [];

    // 2. Iterate through legs, find official odds/line, and inject them
    for (const leg of legs) {
        const matchOdds = matchOddsMap.get(leg.match);
        let officialOdds = null;
        let officialLine = null; // We must find the line too

        // Match all required criteria to find the correct official odds and line
        if (leg.betCategory === "body" && matchOdds.handicap) {
            // For 'body' (Handicap), we assume the odds array only contains the current best line.
            // We need to look up which line corresponds to the 'market' (home/away)

            if (leg.market === "home") {
                officialOdds = matchOdds.handicap.home_price;
                officialLine = matchOdds.handicap.home_line;
            } else if (leg.market === "away") {
                officialOdds = matchOdds.handicap.away_price;
                officialLine = matchOdds.handicap.away_line;
            }
        } else if (leg.betCategory === "overUnder" && matchOdds.over_under) {
            // For 'overUnder', the line is a single value in the odds object

            if (leg.market === "over") {
                officialOdds = matchOdds.over_under.over_price;
                officialLine = matchOdds.over_under.line.toString();
            } else if (leg.market === "under") {
                officialOdds = matchOdds.over_under.under_price;
                officialLine = matchOdds.over_under.line.toString();
            }
        }

        // --- Add logic for 'correctScore' or other categories here...

        // 3. Validation Check
        if (!officialOdds || !officialLine) {
            throw new Error(
                `Validation failed: No valid line/odds found for bet category: ${leg.betCategory}, market: ${leg.market} on match ${leg.match}.`
            );
        }

        // 4. Inject the official line and odds into the leg object
        leg.line = officialLine;
        leg.odds = officialOdds;

        // 5. Update the total odds calculation
        totalOdds *= officialOdds;

        // Push the now complete/validated leg
        validatedLegs.push(leg);
    }

    // 6. Return the results
    return { validatedLegs, totalOdds };
};
