/**
 * Maps BetLeg's betCategory/period to the CommissionSetting field names.
 * This map must be accurate to your commission model fields.
 */
const BET_CATEGORY_MAP = {
    body: "hdpOuFtLg", // Full-time body/handicap -> Large markets
    overunder: "hdpOuFtLg", // Full-time O/U -> Large markets
    correctscore: "csFt",
    mixparlay: "mixParlay3to8", // Needs dynamic mapping based on number of legs
    // NOTE: Keys are lowercased to match the rawCategory used in settlementService
    // Add Half-time and Small market mappings as needed
};

// Function to safely get the commission field
exports.getCommissionField = (rawCategory) => {
    return BET_CATEGORY_MAP[rawCategory.toLowerCase()] || null;
};
