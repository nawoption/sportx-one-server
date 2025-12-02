const BetSlip = require("../models/betslipModel");
const { calculateSinglePayout, calculateParlayPayout } = require("../utils/betCalculator");
const { v4: uuidv4 } = require("uuid");

// --- FUNNY MESSAGING LOGIC ---
const generateFunnyMessage = (status, profit, betType) => {
    if (status === "won") {
        if (profit >= 500) {
            return `💰 HOLY COW! ${betType.toUpperCase()} BET WON! The house is crying. Your genius level is over 9000.`;
        }
        return `✅ Profit locked in! Time for a small celebration. You're an Armchair Expert.`;
    }

    if (status === "half-won") {
        return `🥉 HALF-WIN! Your bet was so confusing, the bookie gave you half the money to leave him alone.`;
    }

    if (status === "push") {
        return `🔄 PUSH! All money back. You successfully predicted a nothingburger. Zero points for excitement.`;
    }

    if (status === "half-lost") {
        return `📉 HALF-LOST. Just enough to sting, but not enough to quit. You're the ultimate tease.`;
    }

    // Status 'lost'
    if (profit <= -500) {
        return `🔥 TOTAL BURN! You bet the house and the house politely declined. Please check your predictions for blind faith.`;
    }
    return `❌ LOST. It happens. Don't worry, your next bet will be just as delusional.`;
};

/**
 * Handles POST /api/bets/place
 */
exports.placeBet = async (req, res) => {
    try {
        const betData = req.body; // Use the entire body directly

        // Generate unique ID and prep for saving
        const slipId = `${uuidv4().split("-")[0].toUpperCase()}`;

        const newBet = new BetSlip({
            ...betData,
            slipId,
            user: req.user._id, // Assuming user ID is passed in body/middleware
            ipAddress: req.ip,
            deviceInfo: req.headers["user-agent"],
        });

        await newBet.save();

        res.status(201).json({
            message: "Bet placed successfully! Good luck, you'll need it.",
            slipId: newBet.slipId,
            data: newBet,
        });
    } catch (err) {
        // Handle MongoDB/other errors
        console.error("Bet placement error:", err);
        res.status(500).json({ error: err.message || "Internal Server Error during bet placement." });
    }
};

exports.getBetHistory = async (req, res) => {
    try {
        const userId = req.user._id;

        const bets = await BetSlip.find({ user: userId }).sort({ createdAt: -1 });

        res.json({
            message: "Bet history retrieved successfully.",
            count: bets.length,
            bets,
        });
    } catch (err) {
        console.error("Get bet history error:", err);
        res.status(500).json({ error: "Internal Server Error during fetching bet history." });
    }
};

/**
 * Handles POST /api/bets/settle/:slipId
 * NOTE: This endpoint should typically be restricted to admin users or a dedicated service.
 */
exports.settleBet = async (req, res) => {
    try {
        const { slipId } = req.params;
        const { matchResults } = req.body;

        const bet = await BetSlip.findOne({ slipId });
        if (!bet) return res.status(404).json({ error: "Bet slip not found" });
        if (bet.status !== "pending") return res.status(400).json({ error: "Bet is already settled." });

        let result;

        // 1. Calculate Payout based on bet type
        if (bet.betType === "single") {
            // ... (single bet logic remains the same) ...
            const matchResId = bet.single.match;
            const matchRes = matchResults[matchResId];

            if (!matchRes) return res.status(400).json({ error: `Match result for ${matchResId} is missing.` });

            result = calculateSinglePayout(bet, matchRes);

            // For single bet, update the main single field with the leg status/multiplier
            bet.single.legStatus = result.status;
            // The profit/payout here already implies the multiplier for single bets
        } else if (bet.betType === "parlay") {
            result = calculateParlayPayout(bet, matchResults);

            // ✅ CRITICAL UPDATE: Replace the parlay array with the processed one
            // The processedLegs array now contains the specific status (won/lost/half-won)
            // and multiplier for each match.
            bet.parlay = result.processedLegs;
        } else {
            return res.status(400).json({ error: "Invalid bet type." });
        }

        // 2. Update DB with overall results
        bet.status = result.status;
        bet.payout = result.payout;
        bet.profit = result.profit;
        bet.conditions = "paidout";

        // 3. Generate and store the funny message/points
        bet.systemMessage = generateFunnyMessage(result.status, result.profit, bet.betType);

        await bet.save();

        // 4. Return Final Response
        res.json({
            success: true,
            slipId: bet.slipId,
            finalStatus: bet.status.toUpperCase(),
            payout: bet.payout,
            profit: bet.profit,
            message: bet.systemMessage,
        });
    } catch (err) {
        console.error("Bet settlement error:", err);
        res.status(500).json({ error: "Internal Server Error during bet settlement." });
    }
};
