const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        contact: { type: String, default: "" },

        role: {
            type: String,
            enum: ["Admin", "Super", "Senior", "Master", "Agent", "User"],
            required: true,
        },

        // Upline
        upline: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },

        // Downlines
        downlines: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Account",
            },
        ],

        // Limit & Commission Model
        limitSetting: { type: mongoose.Schema.Types.ObjectId, ref: "LimitSetting" },
        commissionSetting: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CommissionSetting",
        },

        // Sub-Account fields
        isSubAccount: { type: Boolean, default: false },
        parentAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },

        // permissions
        permissions: {
            type: [String],
            default: [],
        },

        status: {
            type: String,
            enum: ["ACTIVE", "BANNED"],
            default: "ACTIVE",
        },
        isChangePassword: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Account", accountSchema);
