const BetSlip = require("../models/betSlipModel");
const mongoose = require("mongoose");
const balanceService = require("../services/balanceService");
const { v4: uuidv4 } = require("uuid");
const betValidationService = require("../services/betValidationService");
const BalanceTransaction = require("../models/balanceTransactionModel");

exports.placeBet = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.user._id;
        const { betSystem, betType, stake, legs } = req.body;

        if (!stake || stake <= 0 || !legs || legs.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Invalid stake or missing bet legs." });
        }

        // 1. Validate Legs and Calculate Total Odds
        let validationResult;
        try {
            validationResult = await betValidationService.validateAndCalculateOdds(betSystem, betType, legs);
        } catch (error) {
            await session.abortTransaction();
            // Return specific validation error message from the service
            return res.status(400).json({ success: false, message: error.message });
        }

        // Destructure validated results
        const { validatedLegs, totalOdds } = validationResult;

        // Final Type/Length Check
        if (betType === "parlay" && legs.length < 2) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Parlay must have 2 or more legs." });
        }

        // 2. Create and Save the new BetSlip instance
        const slipId = `${uuidv4().split("-")[0].toUpperCase()}`;

        const newBetSlip = new BetSlip({
            user: userId,
            betType: betType,
            betSystem,
            slipId: slipId,
            stake: stake,
            legs: validatedLegs,
            status: "pending",
            totalOdds: totalOdds, // Use the official calculated total odds
        });

        // Save BetSlip within the transaction
        await newBetSlip.save({ session });

        // 3. Check Balance and Debit Stake
        try {
            await balanceService.debitStake(userId, stake, newBetSlip._id, session);
        } catch (error) {
            // Catches "Insufficient cash balance or balance document not found."
            await session.abortTransaction();
            return res.status(400).json({ error: error.message });
        }

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: "Bet placed successfully. Status: Pending Settlement.",
            slipId: newBetSlip._id,
        });
    } catch (err) {
        // Handle unexpected errors (database connection, etc.)
        await session.abortTransaction();
        session.endSession();
        console.error("Error placing bet:", err);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

exports.getBettingHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, limit = 10, page = 1, startDate, endDate } = req.query;

        const findQuery = { user: userId };
        if (status && status !== "all") {
            findQuery.status = status;
        }

        if (startDate || endDate) {
            findQuery.createdAt = {};
            if (startDate) {
                findQuery.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                findQuery.createdAt.$lte = new Date(endDate);
            }
        }

        const totalCount = await BetSlip.countDocuments(findQuery);

        const slips = await BetSlip.find(findQuery)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate({
                path: "legs.match", // Target the 'match' field within the 'legs' array
                model: "Match", // Specify the model to reference
            })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();

        res.json({
            success: true,
            total: totalCount,
            page: parseInt(page),
            limit: limit,
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            data: slips,
        });
    } catch (err) {
        console.error("Error fetching betting history:", err);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

exports.getBetDetail = async (req, res) => {
    try {
        const userId = req.user._id;
        const { slipId } = req.params;

        // 1️⃣ Load bet slip (ownership check)
        const betSlip = await BetSlip.findOne({
            _id: slipId,
            user: userId,
        })
            .populate({
                path: "legs.match",
                model: "Match",
            })
            .lean();

        if (!betSlip) {
            return res.status(404).json({
                success: false,
                message: "Bet slip not found",
            });
        }

        // 2️⃣ Load related balance transactions
        const transactions = await BalanceTransaction.find({
            betSlip: betSlip._id,
            user: userId,
        })
            .sort({ createdAt: 1 }) // Bet → Won
            .lean();

        return res.json({
            success: true,
            bet: betSlip,
            transactions,
        });
    } catch (err) {
        console.error("Error fetching bet detail:", err);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
        });
    }
};
