/**
 * Calculates the outcome and multiplier for a single bet leg (Handicap/Body or Over/Under).
 * * @param {Object} leg - The individual BetLeg object from the BetSlip.
 * @param {Object} score - The final score object for the relevant period (e.g., {home: 5, away: 2}).
 * @returns {{outcome: string, multiplier: number}}
 */
const calculateLegOutcome = (leg, score) => {
    if (!score) {
        console.warn(`Score data missing for match ${leg.match} period ${leg.period}`);
        return { outcome: "pending", multiplier: 0 };
    }

    const { betCategory, market, line } = leg;

    // Determine the relevant score difference (Home vs Away for Body, Total for Over/Under)
    let comparisonValue; // This is the value compared against the line.
    let lineNumeric = parseFloat(line.replace(/[+-]/g, "")); // Clean line value (e.g., " -2" -> 2)

    if (betCategory === "body") {
        // Body (Asian Handicap) calculation is based on difference
        comparisonValue = score.home - score.away;

        // Adjust the line for the chosen market
        if (market === "home") {
            lineNumeric = -lineNumeric; // Home -2 means comparing score diff against -2
        } else if (market === "away") {
            lineNumeric = lineNumeric; // Away +2 means comparing score diff against +2
        }

        // Actual difference in score based on the bet line
        const difference = comparisonValue + lineNumeric;

        // --- BODY CALCULATION LOGIC ---
        if (difference > 0.25) {
            // Win by 0.5 or more
            return { outcome: "won", multiplier: 1.0 };
        } else if (difference < -0.25) {
            // Lose by 0.5 or more
            return { outcome: "lost", multiplier: 0.0 };
        } else if (difference > 0 && difference <= 0.25) {
            // Half-Win (e.g., diff = 0.25)
            return { outcome: "half-won", multiplier: 0.5 };
        } else if (difference < 0 && difference >= -0.25) {
            // Half-Lose (e.g., diff = -0.25)
            return { outcome: "half-lost", multiplier: -0.5 };
        } else {
            // Exactly 0 difference (Push)
            return { outcome: "push", multiplier: 0.0 };
        }
    } else if (betCategory === "overUnder") {
        // Over/Under calculation is based on total score
        comparisonValue = score.home + score.away;

        // --- OVER/UNDER CALCULATION LOGIC ---

        // Adjust the line (e.g., if line is 4)
        const difference = comparisonValue - lineNumeric;

        if (market === "over") {
            if (difference > 0.25) {
                // Over wins (score > line + 0.5)
                return { outcome: "won", multiplier: 1.0 };
            } else if (difference < -0.25) {
                // Over loses (score < line - 0.5)
                return { outcome: "lost", multiplier: 0.0 };
            } else if (difference > 0 && difference <= 0.25) {
                // Half-Win (score = line + 0.25)
                return { outcome: "half-won", multiplier: 0.5 };
            } else if (difference < 0 && difference >= -0.25) {
                // Half-Lose (score = line - 0.25)
                return { outcome: "half-lost", multiplier: -0.5 };
            } else {
                // Exactly 0 difference (score = line)
                return { outcome: "push", multiplier: 0.0 };
            }
        } else if (market === "under") {
            // Under outcomes are the inverse of Over outcomes
            if (difference < -0.25) {
                // Under wins (score < line - 0.5)
                return { outcome: "won", multiplier: 1.0 };
            } else if (difference > 0.25) {
                // Under loses (score > line + 0.5)
                return { outcome: "lost", multiplier: 0.0 };
            } else if (difference < 0 && difference >= -0.25) {
                // Half-Win (score = line - 0.25)
                return { outcome: "half-won", multiplier: 0.5 };
            } else if (difference > 0 && difference <= 0.25) {
                // Half-Lose (score = line + 0.25)
                return { outcome: "half-lost", multiplier: -0.5 };
            } else {
                // Exactly 0 difference (score = line)
                return { outcome: "push", multiplier: 0.0 };
            }
        }
    }

    // For other categories like 'correctScore', the logic is simpler: won (1.0) or lost (0.0)
    // You would implement that logic here if needed.
    return { outcome: "lost", multiplier: 0.0 };
};

/**
 * Calculates the final outcome and financial results for an entire BetSlip (Single or Parlay).
 * @param {Object} betSlip - The BetSlip object with all legs settled.
 * @returns {{status: string, profit: number, payout: number}}
 */
const finalizeSlipSettlement = (betSlip) => {
    const { betType, stake, legs } = betSlip;

    // Step 1: Check overall status of the slip based on legs
    let overallStatus = "won"; // Start by assuming a win

    // Array of all final multipliers (1.0, 0.5, -0.5, 0.0)
    const legMultipliers = legs.map((leg) => leg.payoutMultiplier);

    // Check for a loss/half-loss in any leg
    if (legMultipliers.some((m) => m === 0.0 || m === -0.5)) {
        overallStatus = "lost";
    } else if (legMultipliers.some((m) => m === 0.5)) {
        // If no full losses, but there are half wins, the slip is still a 'won' status
        // but the odds calculation handles the final profit.
        overallStatus = "won";
    }

    // Check for push (only if all legs are push, which is rare for parlay)
    if (legMultipliers.every((m) => m === 0.0)) {
        overallStatus = "push";
    }

    // Step 2: Calculate Total Payout and Profit
    let profit = 0;
    let payout = 0;

    if (overallStatus === "lost") {
        payout = 0;
        profit = -stake;
    } else if (overallStatus === "push") {
        payout = stake;
        profit = 0;
    } else {
        // For Won (including half-won legs)

        let finalOddsMultiplier = 1;

        if (betType === "single" && legs.length === 1) {
            // Single Bet calculation
            const leg = legs[0];
            if (leg.outcome === "won") {
                finalOddsMultiplier = leg.odds;
            } else if (leg.outcome === "half-won") {
                // Formula: Stake + (Odds * 0.5)
                finalOddsMultiplier = 1 + (leg.odds - 1) * 0.5;
            } else if (leg.outcome === "half-lost") {
                // Formula: Stake - (Stake * 0.5)
                finalOddsMultiplier = 0.5;
            } else {
                // Should be covered by lost/push check above, but as a safeguard:
                finalOddsMultiplier = 0;
            }
        } else if (betType === "parlay") {
            // Parlay Bet calculation: Multiply adjusted odds

            finalOddsMultiplier = legs.reduce((acc, leg) => {
                let adjustedOdds = 1;

                if (leg.outcome === "won") {
                    adjustedOdds = leg.odds;
                } else if (leg.outcome === "half-won") {
                    // Half-win in parlay: (Odds - 1) * 0.5 + 1
                    adjustedOdds = 1 + (leg.odds - 1) / 2;
                } else if (leg.outcome === "half-lost") {
                    adjustedOdds = 0.5; // Half-lost makes the odds 0.5
                } else if (leg.outcome === "push") {
                    adjustedOdds = 1; // Push means odds remain 1.0 (doesn't affect cumulative odds)
                } else if (leg.outcome === "lost") {
                    // A single loss instantly fails the entire parlay
                    return 0;
                }

                return acc * adjustedOdds;
            }, 1);

            // If any leg was a full loss, finalOddsMultiplier will be 0.
            if (finalOddsMultiplier === 0) {
                overallStatus = "lost";
                payout = 0;
                profit = -stake;
                return { status: overallStatus, profit, payout };
            }
        }

        // Final Payout calculation for successful (won/partial) bets
        payout = stake * finalOddsMultiplier;
        profit = payout - stake;
    }

    return { status: overallStatus, profit: profit, payout: payout };
};

module.exports = {
    calculateLegOutcome,
    finalizeSlipSettlement,
};
