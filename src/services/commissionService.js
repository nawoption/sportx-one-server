const Account = require("../models/accountModel");
const CommissionTransaction = require("../models/commissionTransactionModel");
const { getCommissionFieldByBetType } = require("../utils/commissionMap");
const balanceService = require("./balanceService");

/**
 * Traverses the hierarchy from the Agent up to the top and calculates the spread commission.
 * (This function is crucial for determining the % rate earned by each upline.)
 * * @param {mongoose.ObjectId} agentId - The ID of the direct Upline of the user.
 * @param {string} betCategoryField - The field name in the CommissionSetting (e.g., 'hdpOuFtLg').
 * @param {number} stake - The original stake amount.
 * @returns {Array<{accountId: mongoose.Types.ObjectId, earningRate: number, earningAmount: number}>}
 */
async function calculateHierarchyCommissions(agentId, betCategoryField, stake) {
    const commissions = [];
    let currentAccount = await Account.findById(agentId).populate("upline").populate("commissionSetting");
    let previousRate = 0; // The end-user effectively has 0% commission assigned.

    // Traversal continues as long as an account is found AND it's not the final Super/Admin with upline: null/undefined
    while (currentAccount && currentAccount.upline !== undefined) {
        // 1. Get the assigned rate for the current account
        const currentRate =
            currentAccount.commissionSetting && currentAccount.commissionSetting[betCategoryField]
                ? currentAccount.commissionSetting[betCategoryField]
                : 0;

        // 2. Calculate the spread: Commission earned by the current account
        const spreadRate = currentRate - previousRate;

        if (spreadRate > 0) {
            const earningAmount = stake * (spreadRate / 100);
            commissions.push({
                accountId: currentAccount._id,
                earningRate: spreadRate,
                earningAmount: earningAmount,
            });
        }

        // 3. Move up the hierarchy
        if (currentAccount.upline) {
            // Fetch the next upline and set previous rate for the next iteration
            const nextUpline = await Account.findById(currentAccount.upline)
                .populate("upline")
                .populate("commissionSetting");

            previousRate = currentRate;
            currentAccount = nextUpline;
        } else {
            // Reached the top of the hierarchy chain (Super/Admin). Exit loop.
            break;
        }
    }

    return commissions;
}

/**
 * Distributes the calculated commissions by recording transactions and updating agent balances.
 * * @param {mongoose.Session} session - The active mongoose session.
 * * @param {Object} slip - The settled bet slip document.
 * * @param {Array<Object>} commissionEarnings - The commission data from calculateHierarchyCommissions.
 */
async function distributeCommissions(session, slip, commissionEarnings) {
    let transactionsToInsert = [];

    if (commissionEarnings.length > 0) {
        const betCategoryField = getCommissionFieldByBetType(slip.betType);

        transactionsToInsert = commissionEarnings.map((comm) => ({
            user: comm.accountId,
            betSlip: slip._id,
            commissionRate: comm.earningRate,
            amount: comm.earningAmount,
            originalStake: slip.stake,
            betCategory: betCategoryField,
        }));

        // 1. Insert Commission Transaction Records within the active session
        await CommissionTransaction.insertMany(transactionsToInsert, { session });
        console.log(`[COMMISSION] Inserted ${commissionEarnings.length} transactions for slip ${slip._id}.`);

        // 2. Credit Commission to Agent Balances
        for (const transaction of transactionsToInsert) {
            // REPLACED: Original manual Balance.findOneAndUpdate logic
            await balanceService.creditCommission(transaction.user, transaction.amount, session);
        }
    }

    return transactionsToInsert;
}

exports.processCommissionDistribution = async (session, slip) => {
    const bettingUser = slip.user;
    const agentId = bettingUser.upline;
    const betType = slip.betType;

    if (!agentId) {
        console.log(`[COMMISSION] Skipping commission: User ${bettingUser.username} has no upline.`);
        return;
    }

    // --- CRITICAL DEFENSIVE CHECK ---
    if (!betType) {
        console.error(`[COMMISSION] BetSlip ${slip._id} is missing required 'betType' for commission calculation.`);
        return;
    }
    // ---------------------------------

    // Determine the commission field name based ONLY on betType
    const betCategoryField = getCommissionFieldByBetType(betType);

    if (!betCategoryField) {
        console.warn(`[COMMISSION] Skipping commission: BetType '${betType}' is not mapped to a commission field.`);
        return;
    }

    // Calculate the potential earnings for all uplines
    const commissionEarnings = await calculateHierarchyCommissions(
        agentId,
        betCategoryField, // Use the determined field
        slip.stake
    );

    // Record transactions and update balances
    await distributeCommissions(session, slip, commissionEarnings);
};
