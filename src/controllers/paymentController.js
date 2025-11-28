const PaymentTransaction = require("../models/paymentModel");

const paymentController = {
    getMyTransactions: async (req, res) => {
        const actor = req.user;

        const { startDate, endDate, lineType = "downline", page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        try {
            const query = {};
            if (lineType === "upline") {
                query.to = actor._id;
            } else if (lineType === "downline") {
                query.from = actor._id;
            }

            if (startDate) {
                query.createdAt = { ...query.createdAt, $gte: new Date(startDate) };
            }
            if (endDate) {
                query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
            }

            const transactions = await PaymentTransaction.find(query)
                .sort({ createdAt: -1 })
                .skip(Number(skip))
                .limit(Number(limit))
                .populate("from", "username role")
                .populate("to", "username role");

            const total = await PaymentTransaction.countDocuments(query);

            return res.status(200).json({
                lineType,
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
                transactions,
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: error.message });
        }
    },

    getUserTransactions: async (req, res) => {
        try {
            const { id } = req.params;
            const { startDate, endDate, page = 1, limit = 20 } = req.query;
            const skip = (page - 1) * limit;
            const query = {};
            if (startDate) {
                query.createdAt = { $gte: new Date(startDate) };
            }
            if (endDate) {
                query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
            }
            let paymentTransactions = await PaymentTransaction.find({ ...query, $or: [{ from: id }, { to: id }] })
                .sort({ createdAt: -1 })
                .skip(Number(skip))
                .limit(Number(limit))
                .populate("from", "username role")
                .populate("to", "username role");

            res.status(200).json({
                paymentTransactions,
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: error.message });
        }
    },
};

module.exports = paymentController;
