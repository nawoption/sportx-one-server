const Joi = require("joi");

const betOptionSchema = Joi.object({
    match: Joi.string().required(),
    period: Joi.string().valid("full-time", "half-time").required(),
    betCategory: Joi.string().valid("body", "overUnder").required(),
    market: Joi.string().valid("home", "away", "over", "under").required(),
    odds: Joi.number().positive().required(),
    handicapLine: Joi.number().required(),
    detail: Joi.string().optional(),
});

const placeBetSchema = Joi.object({
    betType: Joi.string().valid("single", "parlay").required(),
    stake: Joi.number().min(1).required(),
    // Conditional validation based on betType
    single: Joi.when("betType", {
        is: "single",
        then: betOptionSchema.required(),
        otherwise: Joi.forbidden(),
    }),
    parlay: Joi.when("betType", {
        is: "parlay",
        then: Joi.array().items(betOptionSchema).min(2).required(),
        otherwise: Joi.forbidden(),
    }),
});

module.exports = { placeBetSchema };
