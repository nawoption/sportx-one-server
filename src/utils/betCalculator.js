/**
 * --- BET CALCULATOR FOR ASIAN HANDICAP & MALAYSIAN ODDS ---
 * * Assumes the 'odds' field in the bet slip is stored as the numerical multiplier
 * (e.g., +0.85 or -0.90), not the displayed value (+85 or -90).
 */

// --- 1. CORE RESULT CHECKER (DETERMINES WON/LOST/HALF) ---

/**
 * Helper to determine the result status of a single bet selection (leg).
 * This logic relies on the existence of 'handicapLine' in the selection object.
 * * @param {Object} selection - The bet option (match, market, handicapLine)
 * @param {Object} matchResult - { homeScore: 2, awayScore: 1 }
 * @returns {string} - 'won', 'lost', 'half-won', 'half-lost', 'push', or 'error'
 */
const checkSelectionResult = (selection, matchResult) => {
    const { homeScore, awayScore } = matchResult;
    const { betCategory, market, handicapLine } = selection;

    // Safety check: Handicap line is mandatory for these categories
    if (handicapLine === null || typeof handicapLine === "undefined") return "error";

    // --- OVER/UNDER LOGIC ---
    if (betCategory === "overUnder") {
        const totalGoals = homeScore + awayScore;
        const diff = totalGoals - handicapLine;

        if (market === "over") {
            if (diff > 0.5) return "won";
            if (diff === 0.5) return "half-won";
            if (diff === 0) return "push";
            if (diff === -0.5) return "half-lost";
            return "lost";
        }

        if (market === "under") {
            if (diff < -0.5) return "won";
            if (diff === -0.5) return "half-won";
            if (diff === 0) return "push";
            if (diff === 0.5) return "half-lost";
            return "lost";
        }
    }

    // --- ASIAN HANDICAP (BODY) LOGIC ---
    if (betCategory === "body") {
        let actualDiff = homeScore - awayScore;
        let effectiveDiff;

        // Apply the handicap line: Home must win by MORE than the negative handicap
        // Home(-1.5) means Home score is reduced by 1.5. effectiveDiff > 0 means WIN
        if (market === "home") {
            effectiveDiff = actualDiff + handicapLine;
        }
        // Apply the handicap line: Away must win by MORE than the negative handicap
        else if (market === "away") {
            effectiveDiff = actualDiff - handicapLine;
        } else {
            return "error"; // Should only be home/away for body bets
        }

        // Winning/Losing Conditions
        if (effectiveDiff > 0.5) return "won";
        if (effectiveDiff === 0.5) return "half-won";
        if (effectiveDiff === 0) return "push";
        if (effectiveDiff === -0.5) return "half-lost";

        return "lost";
    }

    return "error";
};

// --- 2. PAYOUT CALCULATORS (APPLYING MALAYSIAN ODDS) ---

/**
 * Calculates the payout multiplier for a single selection based on its result and odds.
 * This function is the core of the Malaysian Odds logic.
 * * @param {string} status - 'won', 'lost', 'half-won', 'half-lost', 'push'
 * @param {number} odds - The numerical Malaysian odds (e.g., 0.85 or -0.90)
 * @param {number} stake - The original stake amount
 * @returns {Object} { newStake: number, newProfit: number, newOdds: number }
 */
const getMalaysianPayoutDetails = (status, odds, stake) => {
    let profit = 0;
    let payout = 0;
    let multiplier = 1; // Base multiplier for parlay continuation

    // Payout logic based on result status
    switch (status) {
        case "won":
            if (odds > 0) {
                // Positive Odds (+0.85): Win = Stake * Odds. Risk = Stake.
                profit = stake * odds;
            } else {
                // Negative Odds (-0.90): Win = Stake. Risk = Stake / |Odds|.
                // Payout is based on winning the full stake amount.
                profit = stake;
            }
            payout = stake + profit;
            multiplier = payout / stake;
            break;

        case "half-won":
            if (odds > 0) {
                // Positive Odds (+0.85): Half Profit = (Stake * Odds) / 2. Return = Stake + Half Profit.
                profit = (stake * odds) / 2;
                payout = stake + profit;
            } else {
                // Negative Odds (-0.90): Half Loss of Risk. Profit = Stake / 2.
                // The amount won is HALF the full stake amount.
                profit = stake / 2;
                payout = stake + profit;
            }
            multiplier = payout / stake;
            break;

        case "push":
            // Stake returned, no profit/loss. Multiplier is 1.
            profit = 0;
            payout = stake;
            multiplier = 1;
            break;

        case "half-lost":
            if (odds > 0) {
                // Positive Odds (+0.85): Half of the Stake is lost.
                // Return = Stake / 2. Loss = -Stake / 2.
                profit = -stake / 2;
                payout = stake / 2;
            } else {
                // Negative Odds (-0.90): Half of the RISK amount is lost.
                // Risk is Stake / |Odds|. Half loss = (Stake / |Odds|) / 2.
                // Payout is Stake - Half Loss.
                const riskAmount = stake / Math.abs(odds);
                const halfLoss = riskAmount / 2;
                profit = -halfLoss;
                payout = stake - halfLoss; // This is the amount returned, which is less than the original stake
            }
            multiplier = payout / stake;
            break;

        case "lost":
            // Total loss of the original stake amount (or the risk amount for negative odds)
            profit = -stake;
            payout = 0;
            multiplier = 0;
            break;

        default:
            // Should not happen, but treat as loss for safety
            profit = -stake;
            payout = 0;
            multiplier = 0;
    }

    // Return all values rounded to two decimal places
    return {
        payout: parseFloat(payout.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        multiplier: parseFloat(multiplier.toFixed(4)),
        status: status,
    };
};

/**
 * Calculates Single Bet Payout
 */
const calculateSinglePayout = (bet, matchResult) => {
    const status = checkSelectionResult(bet.single, matchResult);

    if (status === "error") {
        return {
            status: "cancelled",
            payout: 0,
            profit: 0,
            legStatus: "cancelled",
            legMultiplier: 0,
        };
    }

    const details = getMalaysianPayoutDetails(status, bet.single.odds, bet.stake);

    return {
        status: details.status,
        payout: details.payout,
        profit: details.profit,
    };
};

/**
 * Calculates Parlay Payout (All legs must contribute to a multiplier > 0)
 * MODIFIED to return an array of processed legs.
 */
const calculateParlayPayout = (bet, matchResultsMap) => {
    let totalMultiplier = 1;
    let finalStatus = "won";
    const processedLegs = []; // Array to store updated leg data

    for (const leg of bet.parlay) {
        const matchResult = matchResultsMap[leg.match];

        if (!matchResult) {
            // Cannot process leg, entire parlay is un-settleable or error
            finalStatus = "error";
            break;
        }

        const status = checkSelectionResult(leg, matchResult);
        // Calculate details using a stake of 1 to get the pure multiplier
        const details = getMalaysianPayoutDetails(status, leg.odds, 1);

        // Update the leg object with its final status and multiplier
        processedLegs.push({
            ...leg, // Retain original fields
            legStatus: status, // The new status field
            legMultiplier: details.multiplier, // The new multiplier field
        });

        // If any leg is a full loss, the parlay is lost immediately
        if (status === "lost") {
            finalStatus = "lost";
            totalMultiplier = 0;
            break;
        }

        // Apply the multiplier from the leg
        totalMultiplier *= details.multiplier;

        // Downgrade overall status if any leg was not a full win
        if (status !== "won" && finalStatus === "won") {
            finalStatus = status;
        }
    }

    // If a full loss occurred, profit and payout are easy
    if (finalStatus === "lost") {
        return {
            status: "lost",
            payout: 0,
            profit: -bet.stake,
            processedLegs, // Return the updated legs array
        };
    }

    // Calculate final parlay payout
    const payout = bet.stake * totalMultiplier;
    const profit = payout - bet.stake;

    return {
        status: finalStatus,
        payout: parseFloat(payout.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        processedLegs, // Return the updated legs array
    };
};

module.exports = { calculateSinglePayout, calculateParlayPayout, checkSelectionResult };
