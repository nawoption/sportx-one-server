const mongoose = require("mongoose");

const limitSettingSchema = new mongoose.Schema(
    {
        // Body Match
        bodyMatchFT: { type: Number, default: 1000000 },
        bodyMatchHT: { type: Number, default: 500000 },
        // Handicap/Over/Under
        hdpOuMin: { type: Number, default: 1000 },
        hdpOuMax: { type: Number, default: 1000000 },
        // Parlay
        parlayMin: { type: Number, default: 500 },
        parlayMax: { type: Number, default: 200000 },
        // Over/Under Match
        ouMatchFT: { type: Number, default: 1000000 },
        ouMatchHT: { type: Number, default: 500000 },
        // Even/Odd
        eoMinFT: { type: Number, default: 1000 },
        eoMaxFT: { type: Number, default: 500000 },
        // Correct Score (CS)
        csMinFT: { type: Number, default: 1000 },
        csMaxFT: { type: Number, default: 500000 },
        // 1X2
        oneX2MinFT: { type: Number, default: 1000 },
        oneX2MaxFT: { type: Number, default: 500000 },
        // Created by
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("LimitSetting", limitSettingSchema);
