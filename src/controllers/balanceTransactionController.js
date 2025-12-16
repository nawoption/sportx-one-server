const BalanceTransaction = require("../models/balanceTransactionModel");

exports.getTransactionsByBetSlip = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;

        const transactions = await BalanceTransaction.findOne({
            _id: id,
            user: userId, // ownership check
        })
            .sort({ createdAt: 1 }) // Bet → Won / Refund
            .lean();

        return res.json({
            success: true,
            data: transactions,
        });
    } catch (err) {
        console.error("Error fetching balance transactions:", err);
        res.status(500).json({
            success: false,
            error: "Internal Server Error",
        });
    }
};
