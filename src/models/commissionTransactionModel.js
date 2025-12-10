const mongoose = require("mongoose");

const commissionTransactionSchema = new mongoose.Schema({
    // The account that received the commission
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: true,
        index: true,
    },

    // The BetSlip this commission is derived from
    betSlip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BetSlip",
        required: true,
        index: true,
    },

    // The commission rate earned (e.g., 1% or 12%)
    commissionRate: {
        type: Number,
        required: true,
    },

    // The actual amount earned (Stake * commissionRate)
    amount: {
        type: Number,
        required: true,
    },

    // The stake of the original bet (for reference)
    originalStake: {
        type: Number,
        required: true,
    },

    // The category of the bet (e.g., 'hdpOuFtLg')
    betCategory: {
        type: String,
        required: true,
    },

    // Timestamp when the commission was recorded
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("CommissionTransaction", commissionTransactionSchema);
