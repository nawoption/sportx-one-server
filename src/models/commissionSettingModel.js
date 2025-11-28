const mongoose = require("mongoose");

const commissionSettingSchema = new mongoose.Schema(
    {
        hdpOuFtLg: { type: Number, default: 1.0 },
        hdpOuFtSm: { type: Number, default: 1.0 },
        hdpOuHtLg: { type: Number, default: 1.0 },
        hdpOuHtSm: { type: Number, default: 1.0 },
        mixParlay2: { type: Number, default: 7.0 },
        mixParlay3to8: { type: Number, default: 15.0 },
        mixParlay9to11: { type: Number, default: 15.0 },
        oneX2Ft: { type: Number, default: 1.0 },
        csFt: { type: Number, default: 1.0 },
        eoFt: { type: Number, default: 1.0 },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("CommissionSetting", commissionSettingSchema);
