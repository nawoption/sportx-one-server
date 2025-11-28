const mongoose = require("mongoose");

const paymentTransactionSchema = new mongoose.Schema(
    {
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: true,
        },
        to: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: true,
        },
        type: {
            type: String,
            enum: ["deposit", "withdraw"],
            required: true,
        },
        amount: { type: Number, required: true },
        beforeBalance: { type: Number, required: true },
        afterBalance: { type: Number, required: true },
        remark: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model("PaymentTransaction", paymentTransactionSchema);
