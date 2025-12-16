const mongoose = require("mongoose");

const balanceSchema = new mongoose.Schema(
    {
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: true,
            unique: true,
        },
        cashBalance: { type: Number, default: 0 },
        accountBalance: { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Balance", balanceSchema);
