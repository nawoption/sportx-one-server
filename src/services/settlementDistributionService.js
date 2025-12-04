const mongoose = require("mongoose");
const Account = require("../models/accountModel");
const Balance = require("../models/balanceModel");
const CommissionSetting = require("../models/commissionSettingModel");

// --- UTILITY 1: COMMISSION RATE MAPPING ---
// Maps the BetSlip details to the correct commission field in CommissionSetting
const mapBetToCommissionKey = (betSlip) => {
    // This is a simplified mapping based on available fields. Adjust as needed.
    const period = betSlip.single?.period || betSlip.parlay[0]?.period;
    const isFullTime = period === "full-time";

    if (betSlip.betType === "single") {
        if (betSlip.single.betCategory === "body" || betSlip.single.betCategory === "overUnder") {
            // Assuming hdpOuFtLg for all full-time HDP/OU singles
            return isFullTime ? "hdpOuFtLg" : "hdpOuHtLg";
        }
        // Add logic for 1X2, CS, EO if needed
    }

    if (betSlip.betType === "parlay") {
        const legCount = betSlip.parlay.length;
        if (legCount === 2) return "mixParlay2";
        if (legCount >= 3 && legCount <= 8) return "mixParlay3to8";
        if (legCount >= 9) return "mixParlay9to11";
    }
    return null;
};

// --- UTILITY 2: HIERARCHY TRAVERSAL (Fixed Logic) ---
// Recursively finds all upline accounts required for commission distribution
const getUplineChain = async (accountId) => {
    let chain = [];
    let currentAccount = await Account.findById(accountId)
        .select("upline commissionSetting role")
        .populate("upline", "upline commissionSetting role");

    // Traverse upwards until upline is null (top of the hierarchy)
    while (currentAccount && currentAccount.upline) {
        chain.push({
            accountId: currentAccount.upline._id,
            commissionSettingId: currentAccount.upline.commissionSetting,
            role: currentAccount.upline.role,
        });
        currentAccount = await Account.findById(currentAccount.upline._id)
            .select("upline commissionSetting role")
            .populate("upline", "upline commissionSetting role");
    }
    return chain;
};

// --- MAIN DISTRIBUTION LOGIC ---
exports.distributeSettlement = async (betSlip) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const memberId = betSlip.user;
        const betProfit = betSlip.profit;
        const betStake = betSlip.stake;
        // The valid amount for commission is typically slightly less than the stake
        const validAmount = betStake;

        // 1. DETERMINE COMMISSION RATE KEY
        const commissionKey = mapBetToCommissionKey(betSlip);
        if (!commissionKey) throw new Error(`Could not determine commission key for slip ${betSlip.slipId}`);

        // 2. GET UPLINE CHAIN (for commission distribution)
        const uplineChain = await getUplineChain(memberId);

        let previousCommissionRate = 0; // The commission rate of the immediate downline

        // Find the member's account to get their commission setting ID
        const memberAccount = await Account.findById(memberId).session(session);
        if (!memberAccount) throw new Error("Member account not found.");

        // --- TRAVERSE AND UPDATE BALANCES (Bottom-Up) ---
        // Array of accounts to process: [Member, Agent, Master, Senior, Super...]
        const accountsToProcess = [
            {
                accountId: memberId,
                commissionSettingId: memberAccount.commissionSetting,
                isMember: true,
            },
            ...uplineChain.map((a) => ({ ...a, isMember: false })),
        ];

        for (const account of accountsToProcess) {
            const { accountId, commissionSettingId, isMember } = account;

            // a. Fetch Account's Commission Settings
            const commissionDoc = await CommissionSetting.findById(commissionSettingId).session(session);
            const currentCommissionRate = commissionDoc ? commissionDoc[commissionKey] : 0; // e.g., 1.0%

            let commissionEarned = 0;
            let profitLossImpact = 0;

            // b. CALCULATE COMMISSION (Differential Logic)
            if (isMember) {
                // Member gets a flat commission based on their own rate
                commissionEarned = (validAmount * currentCommissionRate) / 100;
                // Member receives the direct bet profit/loss
                profitLossImpact = betProfit;
            } else {
                // Uplines get the difference between their rate and their immediate downline's rate
                const commissionDifference = currentCommissionRate - previousCommissionRate;
                if (commissionDifference > 0) {
                    commissionEarned = (validAmount * commissionDifference) / 100;
                }
                // Uplines usually do NOT receive the profit/loss of the member directly (it's often absorbed by the top level)
                // We assume 0 W/L impact for uplines unless your rule is different.
                profitLossImpact = 0;
            }

            // c. UPDATE BALANCE
            await Balance.findOneAndUpdate(
                { account: accountId },
                {
                    $inc: {
                        cashBalance: profitLossImpact, // Winnings/Losses (only for member)
                        commissionBalance: commissionEarned, // Commissions earned
                        accountBalance: profitLossImpact + commissionEarned, // Total balance change
                    },
                },
                { session, new: true, upsert: true }
            );
        }

        await session.commitTransaction();
        return true;
    } catch (error) {
        await session.abortTransaction();
        console.error(`Settlement distribution failed for slip ${betSlip.slipId}.`, error);
        throw error;
    } finally {
        session.endSession();
    }
};
