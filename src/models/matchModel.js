const mongoose = require("mongoose");

const OddsSchema = new mongoose.Schema(
    {
        handicap: {
            home_line: { type: String }, // e.g., "-2"
            away_line: { type: String }, // e.g., "+2"
            home_price: { type: Number }, // e.g., 29
            away_price: { type: Number }, // e.g., 71
        },
        over_under: {
            line: { type: Number }, // e.g., 4
            over_price: { type: Number }, // e.g., 3
            under_price: { type: Number }, // e.g., 97
        },
    },
    { _id: false }
);

const MatchScoreDetailSchema = new mongoose.Schema(
    {
        home: { type: Number, default: 0 },
        away: { type: Number, default: 0 },
    },
    { _id: false }
);

// --- 3. Match Main Schema ---
const MatchSchema = new mongoose.Schema({
    // External API ID
    apiMatchId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    // Core Match Info
    league: { type: String, required: true },
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },

    // Myanmar Language names
    homeTeamMM: { type: String },
    awayTeamMM: { type: String },

    startTime: { type: Date, required: true },

    // Status (e.g., 'completed', 'active', )
    status: {
        type: String,
        required: true,
        index: true,
    },

    // Results/Scores
    scores: {
        full_time: { type: MatchScoreDetailSchema, default: () => ({}) },
        live: { type: MatchScoreDetailSchema, default: () => ({}) }, // Live scores
    },

    // Odds Data
    odds: { type: OddsSchema, default: () => ({}) },

    // Timestamp for last update
    lastUpdatedAt: { type: Date, default: Date.now },

    // Flag to indicate if match has been settled
    matchSettled: { type: Boolean, default: false, index: true },
});

// Update timestamp before saving
MatchSchema.pre("save", function (next) {
    this.lastUpdatedAt = Date.now();
    next();
});

module.exports = mongoose.model("Match", MatchSchema);
