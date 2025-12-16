const mongoose = require("mongoose");

const balanceTransactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: true,
        },
        betSlip: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BetSlip",
            required: true,
        },
        type: {
            type: String,
            enum: ["Bet", "Won", "Refund"],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        balanceBefore: {
            type: Number,
            required: true,
        },
        balanceAfter: {
            type: Number,
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("BalanceTransaction", balanceTransactionSchema);
