const Account = require("../models/accountModel");
const Balance = require("../models/balanceModel");
const CommissionSetting = require("../models/commissionSettingModel");

// --- UTILITY 1: COMMISSION RATE MAPPING ---
// Map BetSlip details to the correct CommissionSetting field
const mapBetToCommissionKey = (betSlip) => {
    // This logic must be detailed based on your business rules (e.g., is it a large league or small league?)
    const period = betSlip.single?.period || betSlip.parlay[0]?.period;
    const isFullTime = period === "full-time";

    if (
        (betSlip.betType === "single" && betSlip.single?.betCategory === "body") ||
        betSlip.single?.betCategory === "overUnder"
    ) {
        // SIMPLIFIED: Assume all HDP/OU bets map to the large league FT rate for now.
        return isFullTime ? "hdpOuFtLg" : "hdpOuHtLg";
    }

    if (betSlip.betType === "parlay") {
        const legCount = betSlip.parlay.length;
        if (legCount === 2) return "mixParlay2";
        if (legCount >= 3 && legCount <= 8) return "mixParlay3to8";
        if (legCount >= 9) return "mixParlay9to11";
    }
    return null; // Should not happen
};

// --- UTILITY 2: HIERARCHY TRAVERSAL ---
// Traverse from the member up to the top level (Company)
const getUplineChain = async (accountId) => {
    let chain = [];
    let currentAccount = await Account.findById(accountId).select("upline role commissionSetting");

    while (currentAccount && currentAccount.upline) {
        const uplineAccount = await Account.findById(currentAccount.upline).select("upline role commissionSetting");
        if (!uplineAccount) break;
        chain.push({
            accountId: uplineAccount._id,
            commissionSettingId: uplineAccount.commissionSetting,
            role: uplineAccount.role,
        });
        currentAccount = uplineAccount;
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
        const validAmount = betStake * 0.98; // SIMPLIFIED: As seen in report (6000 -> 5900 is approx 98.3%)

        // 1. DETERMINE COMMISSION RATE KEY
        const commissionKey = mapBetToCommissionKey(betSlip);
        if (!commissionKey) throw new Error(`Could not determine commission key for slip ${betSlip.slipId}`);

        // 2. GET UPLINE CHAIN
        const uplineChain = await getUplineChain(memberId);

        let previousCommissionRate = 0; // The commission rate of the immediate downline

        // --- TRAVERSE AND UPDATE BALANCES (Bottom-Up) ---
        // Start by collecting all affected IDs: [memberId, ...uplines]
        const accountsToUpdate = [
            {
                accountId: memberId,
                commissionSettingId: betSlip.user.commissionSetting, // assuming betSlip.user has populated setting
            },
            ...uplineChain,
        ];

        for (const account of accountsToUpdate) {
            const currentAccountId = account.accountId;

            // a. Fetch Account's Commission Settings
            const commissionDoc = await CommissionSetting.findById(account.commissionSettingId).session(session);
            const currentCommissionRate = commissionDoc ? commissionDoc[commissionKey] : 0; // e.g., 1.0%

            // b. Calculate Commission (Differential Commission)
            const commissionDifference = currentCommissionRate - previousCommissionRate;
            let commissionEarned = 0;

            if (commissionDifference > 0) {
                // Commission is earned on the valid amount
                commissionEarned = (validAmount * commissionDifference) / 100;
            } else if (currentAccountId.toString() === memberId.toString()) {
                // Member gets commission regardless of hierarchy diff (Flat Commission for User)
                commissionEarned = (validAmount * currentCommissionRate) / 100;
            }

            // c. Calculate W/L Impact
            let profitLossImpact = 0;
            if (currentAccountId.toString() === memberId.toString()) {
                // Member receives the direct bet profit/loss
                profitLossImpact = betProfit;
            } else {
                // Uplines share in the loss/profit of the member.
                // Simplified: Uplines share the Net W/L of the member's bets
                // Report shows: Senior W/L = 0, Company W/L = 2000. This implies Company is absorbing the W/L.
                // This logic needs external documentation, but we'll assume the company absorbs the net W/L.
            }

            // d. Update Balance
            await Balance.findOneAndUpdate(
                { account: currentAccountId },
                {
                    $inc: {
                        cashBalance: profitLossImpact, // Winnings/Losses affect cash balance
                        commissionBalance: commissionEarned, // Commissions affect commission balance
                        accountBalance: profitLossImpact + commissionEarned, // Total balance change
                    },
                },
                { session, new: true, upsert: true }
            );

            // Set the rate for the next level up
            previousCommissionRate = currentCommissionRate;
        }

        await session.commitTransaction();
        console.log(`Settlement distribution complete for slip ${betSlip.slipId}`);
    } catch (error) {
        await session.abortTransaction();
        console.error(`Settlement distribution failed for slip ${betSlip.slipId}:`, error);
        throw error;
    } finally {
        session.endSession();
    }
};
