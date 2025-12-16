/**
 * Maps the BetSlip's betType to the corresponding CommissionSetting field name.
 * * - 'single' bets default to the main large market rate (hdpOuFtLg).
 * - 'parlay' bets use the dedicated mix parlay rate (mixParlay3to8).
 */
const BET_TYPE_COMMISSION_MAP = {
    single: "hdpOuFtLg",
    parlay: "mixParlay3to8",
};

/**
 * Gets the commission field name based ONLY on the bet type.
 * @param {string} betType - The type of the bet slip (e.g., 'single', 'parlay').
 * @returns {string | null} The commission field name.
 */
exports.getCommissionFieldByBetType = (betType) => {
    if (!betType) {
        return null;
    }
    return BET_TYPE_COMMISSION_MAP[betType.toLowerCase()] || null;
};
