const Balance = require("../models/balanceModel");
const BalanceTransaction = require("../models/balanceTransactionModel");

// ----------------------
// DEBIT STAKE
// ----------------------
exports.debitStake = async (userId, stake, betSlipId, session) => {
    const balanceBefore = await Balance.findOne({ account: userId }).session(session);

    if (!balanceBefore || balanceBefore.cashBalance < stake) {
        throw new Error("Insufficient cash balance.");
    }

    const updatedBalance = await Balance.findOneAndUpdate(
        { account: userId },
        {
            $inc: {
                cashBalance: -stake,
                accountBalance: -stake,
            },
        },
        { new: true, session }
    );

    // ✅ Create transaction record
    await BalanceTransaction.create(
        [
            {
                user: userId,
                betSlip: betSlipId,
                type: "Bet",
                amount: -stake,
                balanceBefore: balanceBefore.cashBalance,
                balanceAfter: updatedBalance.cashBalance,
            },
        ],
        { session }
    );

    return updatedBalance;
};

// ----------------------
// CREDIT PAYOUT
// ----------------------
exports.creditPayout = async (userId, payout, betSlipId, session) => {
    if (payout <= 0) return;

    const balanceBefore = await Balance.findOne({ account: userId }).session(session);

    const updatedBalance = await Balance.findOneAndUpdate(
        { account: userId },
        {
            $inc: {
                cashBalance: payout,
                accountBalance: payout,
            },
        },
        { new: true, session }
    );

    // ✅ Create transaction record
    await BalanceTransaction.create(
        [
            {
                user: userId,
                betSlip: betSlipId,
                type: "Won",
                amount: payout,
                balanceBefore: balanceBefore.cashBalance,
                balanceAfter: updatedBalance.cashBalance,
            },
        ],
        { session }
    );

    return updatedBalance;
};

exports.creditCommission = async (agentId, amount, session) => {
    if (amount <= 0) return;

    const updatedBalance = await Balance.findOneAndUpdate(
        { account: agentId },
        {
            $inc: {
                cashBalance: amount,
                accountBalance: amount,
            },
        },
        { new: true, session: session }
    );

    if (!updatedBalance) {
        // Critical: If an agent's balance document is missing, we must fail the whole transaction
        throw new Error(`Balance document not found for commission recipient: ${agentId}`);
    }

    console.log(`[BALANCE_SERVICE] Credited commission of ${amount} to account: ${agentId}`);
    return updatedBalance;
};
