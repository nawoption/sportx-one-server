const mongoose = require("mongoose");

const subAccountSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        contact: { type: String },
        role: { type: String, enum: ["Admin", "Senior", "Master", "Agent"] },
        commissionSetting: { type: mongoose.Schema.Types.ObjectId, ref: "CommissionSetting" },
        limitSetting: { type: mongoose.Schema.Types.ObjectId, ref: "LimitSetting" },
        createdBy: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "createdByModel" },
        createdByModel: { type: String, required: true, enum: ["Admin", "Senior", "Master", "Agent"] },
        status: { type: String, enum: ["ACTIVE", "BANNED"], default: "ACTIVE" },
        isChangedPassword: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("SubAccount", subAccountSchema);
