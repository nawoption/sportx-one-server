const Match = require("../models/matchModel");

// Fixed odds (Myanmar style always uses ×2)
const MYANMAR_SINGLE_ODDS = 2;
const MYANMAR_PARLAY_ODDS = 2;

exports.validateAndCalculateOdds = async (betSystem, betType, legs) => {
    if (!Array.isArray(legs) || legs.length === 0) {
        throw new Error("No betting legs provided");
    }

    const matchIds = legs.map((leg) => leg.match.toString());

    // 1️⃣ Fetch matches
    const matches = await Match.find({
        _id: { $in: matchIds },
        // status: { $ne: "completed" },
    })
        .select("odds")
        .lean();

    if (matches.length !== matchIds.length) {
        throw new Error("One or more matches not found or already completed");
    }

    const matchMap = new Map(matches.map((m) => [m._id.toString(), m]));

    let totalOdds = 1;
    const validatedLegs = [];

    // 2️⃣ Validate each leg
    for (const leg of legs) {
        const match = matchMap.get(leg.match.toString());
        if (!match) throw new Error("Match not found");

        let line;
        let payoutRate;

        // ================= BODY (HANDICAP) =================
        if (leg.betCategory === "body") {
            if (leg.market === "home") {
                line = match.odds.handicap.home_line;
                payoutRate = match.odds.handicap.home_price;
            } else if (leg.market === "away") {
                line = match.odds.handicap.away_line;
                payoutRate = match.odds.handicap.away_price;
            }
        }

        // ================= OVER / UNDER =================
        else if (leg.betCategory === "overUnder") {
            line = match.odds.over_under.line;

            if (leg.market === "over") {
                payoutRate = match.odds.over_under.over_price;
            } else if (leg.market === "under") {
                payoutRate = match.odds.over_under.under_price;
            }
        }

        // 3️⃣ Validation
        if (line === undefined || payoutRate === undefined) {
            throw new Error(`Invalid betting market for match ${leg.match}`);
        }

        // 4️⃣ Inject locked values
        leg.line = String(line);
        leg.payoutRate = Number(payoutRate);

        // ================= MYANMAR =================
        if (betSystem === "myanmar") {
            leg.odds = betType === "single" ? MYANMAR_SINGLE_ODDS : MYANMAR_PARLAY_ODDS;

            totalOdds *= leg.odds;
        }

        // ================= INTERNATIONAL =================
        if (betSystem === "international") {
            if (!leg.odds || leg.odds <= 1) {
                throw new Error("International odds missing or invalid");
            }
            totalOdds *= leg.odds;
        }

        validatedLegs.push(leg);
    }

    return {
        validatedLegs,
        totalOdds: Math.floor(totalOdds), // no decimals
    };
};
