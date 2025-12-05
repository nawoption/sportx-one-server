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
            enum: ["body", "overUnder", "correctScore", "mixParlay"], // Simplified categories
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
        line: { type: String, required: true }, // The handicap line (e.g., "-2" or "4")
        odds: { type: Number, required: true }, // The price (e.g., 0.90 or 1.25)

        // Settlement Data (Updated by SettlementService)
        outcome: {
            type: String,
            enum: ["unsettled", "won", "lost", "half-won", "half-lost", "push", "cancelled"],
            default: "unsettled",
        },
        payoutMultiplier: { type: Number, default: 0 }, // 1.0 for won, 0.5 for half-won, 0 for lost/push/half-lost
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
        enum: ["pending", "won", "lost", "half-won", "half-lost", "push", "cancelled"],
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
