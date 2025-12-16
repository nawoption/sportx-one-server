const mongoose = require("mongoose");

// --- 1. Bet Leg Schema ---
// Defines a single selection within a BetSlip (used for both single and parlay)
const BetLegSchema = new mongoose.Schema(
    {
        // Match Identifier
        match: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Match",
            required: true,
        },

        // Market Details
        betCategory: {
            type: String,
            required: true,
            enum: ["body", "overUnder"],
        },
        market: {
            type: String,
            required: true,
            enum: ["home", "away", "over", "under"],
        },
        period: {
            type: String,
            required: true,
            enum: ["full-time", "half-time"],
        },

        // Line and Odds at the time of placing the bet (Crucial for Settlement)
        line: { type: String, required: true },
        odds: { type: Number, required: true },
        outcome: {
            type: String,
            enum: ["unsettled", "won", "lost", "cancelled"],
            default: "unsettled",
        },
        payoutMultiplier: { type: Number, default: 0 },
        cashDelta: {
            type: Number,
            default: 0,
        },
        payoutRate: {
            type: Number,
            default: 0,
        },
    },
    { _id: false }
);

// --- 2. Bet Slip Main Schema ---
const BetSlipSchema = new mongoose.Schema({
    // User Info
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: true,
        index: true,
    },
    slipId: {
        type: String,
        required: true,
        unique: true,
    },
    betSystem: {
        type: String,
        required: true,
        enum: ["myanmar", "international"],
        default: "myanmar",
    },

    // Bet Details
    betType: {
        type: String,
        required: true,
        enum: ["single", "parlay"],
    },
    stake: { type: Number, required: true }, // Amount staked
    totalOdds: { type: Number, required: true }, // Total calculated odds for the slip

    // Legs (Only one leg for 'single', multiple legs for 'parlay')
    legs: [BetLegSchema],

    // Settlement Status
    status: {
        type: String,
        required: true,
        enum: ["pending", "won", "lost", "cancelled"],
        default: "pending",
        index: true,
    },
    conditions: {
        type: String,
        enum: ["accepted", "paidout", "rejected"],
        default: "accepted",
    },
    // Financial Outcomes
    profit: { type: Number, default: 0 }, // Net profit (Payout - Stake)
    payout: { type: Number, default: 0 }, // Total return (Stake + Profit)

    createdAt: { type: Date, default: Date.now, index: true },
    settledAt: { type: Date },
});

// Check if the 'BetSlip' model has already been compiled by Mongoose.
// If it has, use the existing model; otherwise, compile and register the new one.
module.exports = mongoose.models.BetSlip ? mongoose.model("BetSlip") : mongoose.model("BetSlip", BetSlipSchema);
