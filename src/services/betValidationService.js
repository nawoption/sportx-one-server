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
        status: { $ne: "completed" },
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

        // ================= ONE X TWO =================
        else if (leg.betCategory === "one_x_two") {
            if (leg.market === "home") {
                payoutRate = match.odds.one_x_two.home_price;
            } else if (leg.market === "away") {
                payoutRate = match.odds.one_x_two.away_price;
            } else if (leg.market === "draw") {
                payoutRate = match.odds.one_x_two.draw_price;
            }
            leg.odds = payoutRate; // Lock the multiplier
        }

        // Validation
        if (payoutRate === undefined) {
            throw new Error(`Invalid market ${leg.market} for ${leg.betCategory}`);
        }

        // 4️⃣ Inject locked values
        leg.line = String(line);
        leg.payoutRate = Number(payoutRate);

        // 5️⃣ Calculate Total Odds
        if (betSystem === "myanmar") {
            leg.odds = betType === "single" ? MYANMAR_SINGLE_ODDS : MYANMAR_PARLAY_ODDS;
            totalOdds *= leg.odds;
        } else if (betSystem === "international") {
            totalOdds *= leg.odds;
        }

        validatedLegs.push(leg);
    }

    return {
        validatedLegs,
        totalOdds: Math.floor(totalOdds), // no decimals
    };
};
