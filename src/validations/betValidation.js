const Joi = require("joi");

// --- 1. BetLeg Schema ---
// This defines the structure of a single bet in the 'legs' array.
const BetLegSchema = Joi.object({
    match: Joi.string()
        .length(24) // Standard length of MongoDB ObjectId string
        .hex() // Must be a hexadecimal string
        .required()
        .messages({
            "string.length": "Match ID must be a 24-character hexadecimal string.",
            "string.hex": "Match ID must be a hexadecimal string.",
            "any.required": "Match ID is required for every leg.",
        }),

    // betCategory: The type of market (used to fetch the correct odds structure).
    betCategory: Joi.string()
        .valid("body", "overUnder", "correctScore", "mixParlay") // Add all supported categories
        .required()
        .messages({
            "any.required": "Bet category is required.",
            "any.only": "Invalid bet category.",
        }),

    // market: The chosen side of the bet (e.g., 'home', 'away', 'over', 'under').
    market: Joi.string().required().messages({
        "any.required": "Market (home/away/over/under) is required.",
    }),

    // period: The time frame of the bet (e.g., 'full-time', 'half-time').
    period: Joi.string().valid("full-time", "half-time").required().messages({
        "any.required": "Bet period (full-time or half-time) is required.",
        "any.only": "Invalid bet period.",
    }),
});

// --- 2. Main Bet Placement Schema (for req.body) ---
const PlaceBetSchema = Joi.object({
    betType: Joi.string().valid("single", "parlay").required().messages({
        "any.required": "Bet type is required.",
        "any.only": 'Invalid bet type. Must be "single" or "parlay".',
    }),

    stake: Joi.number()
        .positive() // Must be greater than 0
        .min(100)
        .required()
        .messages({
            "any.required": "Stake amount is required.",
            "number.positive": "Stake must be a positive number.",
            "number.min": "Stake must be at least 1.",
            "number.base": "Stake must be a number.",
        }),

    legs: Joi.array().items(BetLegSchema).min(1).required().messages({
        "any.required": "Bet must contain at least one leg.",
        "array.min": "Bet must contain at least one leg.",
    }),
})
    .custom((value, helpers) => {
        const { betType, legs } = value;

        if (betType === "single" && legs.length !== 1) {
            return helpers.error("array.singleLegRequired");
        }
        if (betType === "parlay" && legs.length < 2) {
            return helpers.error("array.parlayMin");
        }

        return value;
    }, "Custom Bet Type Validation")
    .messages({
        "array.singleLegRequired": "Single bet type must contain exactly one leg.",
        "array.parlayMin": "Parlay bet type must contain at least two legs.",
    });

module.exports = {
    PlaceBetSchema,
    BetLegSchema,
};
