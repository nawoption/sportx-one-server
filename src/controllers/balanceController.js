const mongoose = require("mongoose");
const Balance = require("../models/balanceModel");
const Account = require("../models/accountModel");
const PaymentTransaction = require("../models/paymentModel");

// ROLE HIERARCHY PERMISSION
const canAdjust = {
    Admin: ["Super", "Senior", "Master", "Agent", "User"],
    Super: ["Senior", "Master", "Agent", "User"],
    Senior: ["Master", "Agent", "User"],
    Master: ["Agent", "User"],
    Agent: ["User"],
};

const BalanceController = {
    // GET BALANCE OF LOGGED-IN USER
    getMyBalance: async (req, res) => {
        try {
            const balance = await Balance.findOne({ account: req.user._id });
            return res.json(balance);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    // GET BALANCE OF ANY ACCOUNT (admin only)
    getBalanceById: async (req, res) => {
        try {
            const { id } = req.params;

            const balance = await Balance.findOne({ account: id }).populate("account", "-password");

            if (!balance) return res.status(404).json({ message: "Balance not found" });

            return res.json(balance);
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    // ADJUST BALANCE (DEPOSIT)
    depositOrWithdraw: async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { accountId, amount, type, remark = "" } = req.body;

            if (amount <= 0) {
                // Must return here to stop execution
                // Abort not strictly necessary here as nothing happened, but good practice
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: "Amount must be positive" });
            }

            const actor = req.user;

            const target = await Account.findById(accountId);
            if (!target) throw new Error("Target account not found");

            // PERMISSION CHECK
            if (!canAdjust[actor.role]?.includes(target.role)) {
                throw new Error("You are not allowed to adjust this account");
            }

            const fromInfo = await Balance.findOne({ account: actor._id }).session(session);
            const toInfo = await Balance.findOne({ account: accountId }).session(session);

            if (!fromInfo || !toInfo) throw new Error("Balance records not found");

            let fromAfter;
            let toAfter;
            let fromBefore;
            let toBefore;

            // Calculate new balances
            if (type === "deposit") {
                fromBefore = Number(fromInfo.cashBalance || 0);
                fromAfter = fromBefore - amount;
                if (fromAfter < 0) throw new Error("Insufficient balance for deposit");

                toBefore = Number(toInfo.cashBalance || 0);
                toAfter = toBefore + amount;
            } else if (type === "withdraw") {
                toBefore = Number(toInfo.cashBalance || 0);
                toAfter = toBefore - amount;
                if (toAfter < 0) throw new Error("Insufficient balance for withdraw");

                fromBefore = Number(fromInfo.cashBalance || 0);
                fromAfter = fromBefore + amount;
            } else {
                throw new Error("Invalid transaction type");
            }

            // Update balances
            fromInfo.cashBalance = fromAfter;
            await fromInfo.save({ session });

            toInfo.cashBalance = toAfter;
            toInfo.accountBalance = toAfter; // Ensure this logic is intended
            await toInfo.save({ session });

            // Create PaymentTransaction Log
            // FIXED: Use dynamic 'type' instead of hardcoded "deposit"
            await PaymentTransaction.create(
                [
                    {
                        from: actor._id,
                        to: target._id,
                        type: type,
                        amount,
                        beforeBalance: toBefore,
                        afterBalance: toAfter,
                        remark,
                    },
                ],
                { session }
            );

            await session.commitTransaction();
            session.endSession();

            // FIXED: Reference the correct variables (toBefore/toAfter)
            return res.json({
                message: "Transaction successful",
                beforeBalance: toBefore,
                afterBalance: toAfter,
            });
        } catch (err) {
            // FIXED: Check if transaction is active before aborting
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
            return res.status(500).json({ message: err.message });
        }
    },
};

module.exports = BalanceController;
