const BetSlip = require("../models/betSlipModel");
const Match = require("../models/matchModel");
const mongoose = require("mongoose");
const Balance = require("../models/balanceModel");
const { v4: uuidv4 } = require("uuid");

/**
 * [POST] /api/bets/place
 * Allows a user to place a new single or parlay bet.
 */
exports.placeBet = async (req, res) => {
    // Also, must validate that the provided odds are correct and not stale.
    // Start a transaction session
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.user._id;
        const { betType, stake, legs } = req.body;

        // 1. Check Balance and Debit Stake
        const userBalance = await Balance.findOne({ account: req.user._id }).session(session);
        if (!userBalance || userBalance.cashBalance < stake) {
            await session.abortTransaction();
            return res.status(400).json({ error: "Insufficient cash balance to place this bet." });
        }
        // Debit the stake from the user's cashBalance
        userBalance.cashBalance -= stake;
        userBalance.accountBalance -= stake;
        await userBalance.save({ session }); // Save balance update within the transaction

        if (!stake || stake <= 0 || !legs || legs.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid stake or missing bet legs." });
        }

        // Generate unique ID and prep for saving
        const slipId = `${uuidv4().split("-")[0].toUpperCase()}`;

        let totalOdds;
        if (betType === "single" && legs.length === 1) {
            totalOdds = legs[0].odds;
        } else if (betType === "parlay" && legs.length > 1) {
            totalOdds = legs.reduce((acc, leg) => acc * leg.odds, 1);
        } else {
            return res.status(400).json({ success: false, message: "Invalid bet type or legs configuration." });
        }

        // Commit the transaction for balance update
        await session.commitTransaction();
        session.endSession();

        // 1. Create the new BetSlip instance
        const newBetSlip = new BetSlip({
            user: userId,
            betType: betType,
            slipId: slipId,
            stake: stake,
            legs: legs, // Legs structure should match BetLegSchema
            status: "pending",
            totalOdds: totalOdds,
        });

        // 2. Save the bet slip
        await newBetSlip.save();

        // 3. (Optional) Deduct funds from user balance here

        res.status(201).json({
            success: true,
            message: "Bet placed successfully. Status: Pending Settlement.",
            slipId: newBetSlip._id,
        });
    } catch (err) {
        console.error("Error placing bet:", err);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

/**
 * [GET] /api/bets/history
 * Fetches the user's betting history.
 */
exports.getBettingHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, limit = 10, page = 1 } = req.query;

        const findQuery = { user: userId };
        if (status && status !== "all") {
            findQuery.status = status;
        }

        const slips = await BetSlip.find(findQuery)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate({
                path: "legs.match", // Target the 'match' field within the 'legs' array
                model: "Match", // Specify the model to reference
            })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        res.json({ success: true, data: slips });
    } catch (err) {
        console.error("Error fetching betting history:", err);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};
