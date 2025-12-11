const Balance = require("../models/balanceModel");
const mongoose = require("mongoose");

/**
 * Debits the stake amount from a user's balance within a transactional session.
 * @param {mongoose.ObjectId} userId - The ID of the user account.
 * @param {number} stake - The amount to debit.
 * @param {mongoose.Session} session - The active mongoose session.
 * @returns {Promise<Object>} The updated Balance document.
 */
exports.debitStake = async (userId, stake, session) => {
    // We use findOneAndUpdate with $inc for atomic update validation
    const updatedBalance = await Balance.findOneAndUpdate(
        {
            account: userId,
            cashBalance: { $gte: stake }, // Ensure sufficient funds before debiting
        },
        {
            $inc: {
                cashBalance: -stake,
                accountBalance: -stake,
            },
        },
        { new: true, session: session }
    );

    if (!updatedBalance) {
        // This implicitly handles both "Balance document not found" AND "Insufficient funds"
        throw new Error("Insufficient cash balance or balance document not found.");
    }

    return updatedBalance;
};

/**
 * Credits the payout amount to a user's balance within a transactional session.
 * @param {mongoose.ObjectId} userId - The ID of the user account.
 * @param {number} payout - The amount to credit.
 * @param {mongoose.Session} session - The active mongoose session.
 * @returns {Promise<Object>} The updated Balance document.
 */
exports.creditPayout = async (userId, payout, session) => {
    if (payout <= 0) return; // Do nothing if there's no payout

    const updatedBalance = await Balance.findOneAndUpdate(
        { account: userId },
        {
            $inc: {
                cashBalance: payout,
                accountBalance: payout,
            },
        },
        { new: true, session: session }
    );

    if (!updatedBalance) {
        throw new Error(`Balance document not found for user: ${userId}`);
    }

    console.log(`[BALANCE_SERVICE] Credited payout of ${payout} to user ${userId}.`);
    return updatedBalance;
};

/**
 * Credits commission to an agent's balance within a transactional session.
 * @param {mongoose.ObjectId} agentId - The ID of the agent account.
 * @param {number} amount - The commission amount to credit.
 * @param {mongoose.Session} session - The active mongoose session.
 * @returns {Promise<Object>} The updated Balance document.
 */
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
