/**
 * Calculates the outcome and multiplier for a single bet leg (Handicap/Body or Over/Under).
 *
 * NOTE: This version is simplified to only return 'won' or 'lost' (and 'push' is now 'lost' or handled as 'won' if a positive margin exists).
 * All half-win/half-loss outcomes have been removed or resolved to a full win/loss.
 *
 * @param {Object} leg - The individual BetLeg object from the BetSlip.
 * @param {Object} score - The final score object for the relevant period (e.g., {home: 5, away: 2}).
 * @returns {{outcome: string, multiplier: number}}
 */
const calculateLegOutcome = (leg, score) => {
    if (!score) {
        console.warn(`Score data missing for match ${leg.match} period ${leg.period}`);
        return { outcome: "pending", multiplier: 0 };
    }

    const { betCategory, market, line } = leg;

    let comparisonValue;
    // Clean line value (e.g., " -2.5" -> 2.5)
    let lineNumeric = parseFloat(line.replace(/[+-]/g, ""));

    if (betCategory === "body") {
        // Body (Asian Handicap)
        comparisonValue = score.home - score.away;

        // Adjust the line for the chosen market
        if (market === "home") {
            // Home -2.5: score_diff must be > -2.5 to win.
            lineNumeric = -lineNumeric;
        } else if (market === "away") {
            // Away +2.5: score_diff must be < +2.5 to win.
            lineNumeric = lineNumeric;
        }

        // Actual difference in score based on the bet line
        const difference = comparisonValue + lineNumeric;

        // --- SIMPLIFIED BODY CALCULATION LOGIC ---
        // A full win requires the difference to be positive
        if (difference > 0) {
            return { outcome: "won", multiplier: 1.0 };
        } else {
            // Any result that is exactly on the line (push) or a loss is now a loss.
            return { outcome: "lost", multiplier: 0.0 };
        }
    } else if (betCategory === "overUnder") {
        // Over/Under
        comparisonValue = score.home + score.away;
        const difference = comparisonValue - lineNumeric;

        // --- SIMPLIFIED OVER/UNDER CALCULATION LOGIC ---
        if (market === "over") {
            // Over wins if the total score is strictly greater than the line.
            if (difference > 0) {
                return { outcome: "won", multiplier: 1.0 };
            } else {
                // Total score is exactly the line (push) or less is a loss.
                return { outcome: "lost", multiplier: 0.0 };
            }
        } else if (market === "under") {
            // Under wins if the total score is strictly less than the line.
            if (difference < 0) {
                return { outcome: "won", multiplier: 1.0 };
            } else {
                // Total score is exactly the line (push) or more is a loss.
                return { outcome: "lost", multiplier: 0.0 };
            }
        }
    }

    // Default return for uncategorized or non-simplified bets (e.g., Correct Score)
    // Assuming 'correctScore' is simple win (1.0) or lose (0.0)
    // The default assumption is a loss if no logic matches.
    return { outcome: "lost", multiplier: 0.0 };
};

// ------------------------------------------------------------------
// The finalizeSlipSettlement function is now much simpler.
// Since legs can only be 'won' or 'lost', we only need to check for a single 'lost' leg.
// ------------------------------------------------------------------

/**
 * Calculates the final outcome and financial results for an entire BetSlip (Single or Parlay).
 *
 * NOTE: This version is simplified for 'won' or 'lost' outcomes only.
 *
 * @param {Object} betSlip - The BetSlip object with all legs settled.
 * @returns {{status: string, profit: number, payout: number}}
 */
const finalizeSlipSettlement = (betSlip) => {
    const { betType, stake, legs } = betSlip;

    let overallStatus = "won";
    let finalOddsMultiplier = 1;

    // Check for a loss in any leg (multiplier of 0.0)
    const hasLoss = legs.some((leg) => leg.payoutMultiplier === 0.0);

    if (hasLoss) {
        overallStatus = "lost";
        finalOddsMultiplier = 0; // Ensures payout logic below yields 0
    } else {
        // Since there are only 'won' or 'lost' outcomes now, and there are no losses,
        // all legs must have been 'won'.

        if (betType === "single" && legs.length === 1) {
            finalOddsMultiplier = legs[0].odds;
        } else if (betType === "parlay") {
            // Parlay Bet calculation: Multiply all winning odds
            finalOddsMultiplier = legs.reduce((acc, leg) => acc * leg.odds, 1);
        }
    }

    // Final Payout calculation
    const payout = stake * finalOddsMultiplier;
    const profit = payout - stake;

    return { status: overallStatus, profit: profit, payout: payout };
};

module.exports = {
    calculateLegOutcome,
    finalizeSlipSettlement,
};
