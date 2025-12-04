const BetSlip = require("../models/betslipModel");
const { calculateSinglePayout, calculateParlayPayout } = require("../utils/betCalculator");
const { v4: uuidv4 } = require("uuid");
const settlementDistributionService = require("../services/settlementDistributionService");
const Balance = require("../models/balanceModel");
const mongoose = require("mongoose");

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

exports.placeBet = async (req, res) => {
    // Start a transaction session
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const betData = req.body;
        const { stake } = betData;

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

        // Generate unique ID and prep for saving
        const slipId = `${uuidv4().split("-")[0].toUpperCase()}`;
        const newBet = new BetSlip({
            ...betData,
            slipId,
            user: req.user._id, // Assuming user ID is passed in body/middleware
            ipAddress: req.ip,
            deviceInfo: req.headers["user-agent"],
        });

        await newBet.save({ session }); // Save bet slip within the transaction
        await session.commitTransaction();
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

exports.settleBet = async (req, res) => {
    try {
        const { slipId } = req.params;
        const { matchResults } = req.body;

        // Find the bet slip and ensure it hasn't been paid out yet
        const bet = await BetSlip.findOne({ slipId });
        if (!bet) return res.status(404).json({ error: "Bet slip not found" });
        if (bet.status !== "pending")
            return res.status(400).json({ error: "Bet is already settled. Status: " + bet.status });
        if (bet.conditions === "paidout")
            return res.status(400).json({ error: "Bet has already been financially paid out." });

        // 1. CALCULATE PAYOUT AND STATUS
        let result;
        if (bet.betType === "single") {
            const matchResId = bet.single.match;
            const matchRes = matchResults[matchResId];
            if (!matchRes) return res.status(400).json({ error: `Match result for ${matchResId} is missing.` });
            result = calculateSinglePayout(bet, matchRes);
            bet.single.legStatus = result.status;
        } else if (bet.betType === "parlay") {
            result = calculateParlayPayout(bet, matchResults);
            bet.parlay = result.processedLegs;
        } else {
            return res.status(400).json({ error: "Invalid bet type." });
        }

        // 2. UPDATE BETSLIP STATUS
        bet.status = result.status;
        bet.payout = result.payout;
        bet.profit = result.profit;
        bet.systemMessage = generateFunnyMessage(result.status, result.profit, bet.betType);

        // Save the settled status before calling the financial service
        await bet.save();

        // 3. FINANCIAL DISTRIBUTION AND PAYOUT (The crucial step)
        const distributionSuccess = await settlementDistributionService.distributeSettlement(bet);

        if (distributionSuccess) {
            bet.conditions = "paidout"; // Mark the slip as financially processed
            await bet.save();
        }

        // 4. RETURN FINAL RESPONSE
        res.json({
            success: true,
            slipId: bet.slipId,
            finalStatus: bet.status.toUpperCase(),
            payout: bet.payout.toFixed(2),
            profit: bet.profit.toFixed(2),
            message: bet.systemMessage,
        });
    } catch (err) {
        console.error("Bet settlement error:", err);
        // Important: If settlement distribution failed, the betslip status should NOT be marked as paidout.
        res.status(500).json({ error: "Internal Server Error during bet settlement or financial distribution." });
    }
};
