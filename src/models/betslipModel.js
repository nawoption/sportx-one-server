const mongoose = require("mongoose");

const betOptionSchema = new mongoose.Schema(
    {
        match: { type: String, required: true },
        period: {
            type: String,
            enum: ["full-time", "half-time"],
            required: true,
        },
        betCategory: {
            type: String,
            enum: ["body", "overUnder"],
            required: true,
        },
        market: {
            type: String,
            enum: ["home", "away", "over", "under"],
            required: true,
        },
        odds: { type: Number, required: true },
        handicapLine: { type: Number, required: true },
        detail: { type: String },
        legStatus: {
            type: String,
            enum: ["unsettled", "won", "lost", "half-won", "half-lost", "push", "cancelled"],
            default: "unsettled",
        },
        legMultiplier: { type: Number, default: 0 },
    },
    { _id: false }
);

const betSlipSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: true,
        },
        slipId: {
            type: String,
            required: true,
            unique: true,
        },
        betType: {
            type: String,
            enum: ["single", "parlay"],
            required: true,
        },
        single: { type: betOptionSchema, default: null },
        parlay: { type: [betOptionSchema], default: [] },
        stake: { type: Number, required: true },

        systemMessage: { type: String, default: null },
        payout: { type: Number, default: 0 },
        profit: { type: Number, default: 0 },
        ipAddress: { type: String },
        deviceInfo: { type: String },
        status: {
            type: String,
            enum: ["pending", "won", "lost", "cancelled", "half-won", "half-lost"],
            default: "pending",
        },
        conditions: {
            type: String,
            enum: ["accepted", "paidout", "rejected"],
            default: "accepted",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("BetSlip", betSlipSchema);
