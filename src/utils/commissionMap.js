const BET_CATEGORY_MAP = {
    body: "hdpOuFtLg",
    overunder: "hdpOuFtLg",
    correctscore: "csFt",
    oneX2Ft: "oneX2Ft",
    mixparlay: "mixParlay3to8",
};

// Function to safely get the commission field
exports.getCommissionField = (rawCategory) => {
    return BET_CATEGORY_MAP[rawCategory.toLowerCase()] || null;
};
