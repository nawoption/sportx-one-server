const Senior = require("../models/seniorModel");
const Master = require("../models/masterModel");
const Agent = require("../models/agentModel");
const User = require("../models/userModel");
const BalanceAccount = require("../models/balanceAccountModel");
const PaymentTransaction = require("../models/paymentTransactionModel");
const { getActor } = require("../middlewares/authMiddlewares");

// Get all Users by Role  for admin view
exports.getAllUsersByRole = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const { role } = req.params;
        let users;
        const options = {
            skip: (page - 1) * limit,
            limit: parseInt(limit),
        };
        let totalCount;
        switch (role) {
            case "Senior":
                totalCount = await Senior.countDocuments({ isDeleted: false });
                users = await Senior.find({ isDeleted: false }, null, options);
                break;
            case "Master":
                totalCount = await Master.countDocuments({ isDeleted: false });
                users = await Master.find({ isDeleted: false }, null, options);
                break;
            case "Agent":
                totalCount = await Agent.countDocuments({ isDeleted: false });
                users = await Agent.find({ isDeleted: false }, null, options);
                break;
            case "User":
                totalCount = await User.countDocuments({ isDeleted: false });
                users = await User.find({ isDeleted: false }, null, options);
                break;
            default:
                return res.status(400).json({ message: "Invalid role specified" });
        }

        res.status(200).json({
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalCount / limit),
            users,
        });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};

exports.getDownlineUsers = async (req, res) => {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ message: "Not authorized" });

    try {
        let members = [];

        // Admin → Seniors + Masters + Agents + Users
        if (actor.type === "Admin") {
            const seniors = await Senior.find({ createdBy: actor.id });
            // fetch balance accounts for each senior
            for (let i = 0; i < seniors.length; i++) {
                const balanceAccount = await BalanceAccount.findOne({ owner: seniors[i]._id, ownerModel: "Senior" });
                seniors[i] = seniors[i].toObject();
                seniors[i].balanceAccount = balanceAccount;
            }

            const masters = await Master.find({
                createdByModel: "Senior",
                createdBy: { $in: seniors.map((s) => s._id) },
            });
            // fetch balance accounts for each master
            for (let i = 0; i < masters.length; i++) {
                const balanceAccount = await BalanceAccount.findOne({ owner: masters[i]._id, ownerModel: "Master" });
                masters[i] = masters[i].toObject();
                masters[i].balanceAccount = balanceAccount;
            }

            const agents = await Agent.find({
                createdByModel: "Master",
                createdBy: { $in: masters.map((m) => m._id) },
            });
            // fetch balance accounts for each agent
            for (let i = 0; i < agents.length; i++) {
                const balanceAccount = await BalanceAccount.findOne({ owner: agents[i]._id, ownerModel: "Agent" });
                agents[i] = agents[i].toObject();
                agents[i].balanceAccount = balanceAccount;
            }

            const users = await User.find({ createdByModel: "Agent", createdBy: { $in: agents.map((a) => a._id) } });
            // fetch balance accounts for each agent
            for (let i = 0; i < users.length; i++) {
                const balanceAccount = await BalanceAccount.findOne({ owner: users[i]._id, ownerModel: "User" });
                users[i] = users[i].toObject();
                users[i].balanceAccount = balanceAccount;
            }

            members = [
                ...seniors.map((s) => ({
                    username: s.username,
                    type: "Senior",
                    cashBalance: s.balanceAccount.cashBalance,
                    _id: s._id,
                })),
                ...masters.map((m) => ({
                    username: m.username,
                    type: "Master",
                    cashBalance: m.balanceAccount.cashBalance,
                    _id: m._id,
                })),
                ...agents.map((a) => ({
                    username: a.username,
                    type: "Agent",
                    cashBalance: a.balanceAccount.cashBalance,
                    _id: a._id,
                })),
                ...users.map((u) => ({
                    username: u.username,
                    type: "User",
                    cashBalance: u.balanceAccount.cashBalance,
                    _id: u._id,
                })),
            ];
        }

        // Senior → Masters + Agents + Users
        if (actor.type === "Senior") {
            const masters = await Master.find({ createdBy: actor.id });
            const agents = await Agent.find({
                createdByModel: "Master",
                createdBy: { $in: masters.map((m) => m._id) },
            });
            const users = await User.find({ createdByModel: "Agent", createdBy: { $in: agents.map((a) => a._id) } });

            members = [
                ...masters.map((m) => ({ username: m.username, type: "Master", _id: m._id })),
                ...agents.map((a) => ({ username: a.username, type: "Agent", _id: a._id })),
                ...users.map((u) => ({ username: u.username, type: "User", _id: u._id })),
            ];
        }

        // Master → Agents + Users
        if (actor.type === "Master") {
            const agents = await Agent.find({ createdBy: actor.id });
            const users = await User.find({ createdByModel: "Agent", createdBy: { $in: agents.map((a) => a._id) } });

            members = [
                ...agents.map((a) => ({ username: a.username, type: "Agent", _id: a._id })),
                ...users.map((u) => ({ username: u.username, type: "User", _id: u._id })),
            ];
        }

        // Agent → Users only
        if (actor.type === "Agent") {
            const users = await User.find({ createdBy: actor.id });

            members = users.map((u) => ({
                username: u.username,
                type: "User",
                _id: u._id,
            }));
        }

        res.json({ members });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.getUserPaymentInfo = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;
        const query = {};
        if (startDate) {
            query.createdAt = { $gte: new Date(startDate) };
        }
        if (endDate) {
            query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
        }
        let balanceAccount = await BalanceAccount.findOne({ owner: id });
        let paymentTransactions = await PaymentTransaction.find({ ...query, $or: [{ from: id }, { to: id }] });

        res.status(200).json({
            balanceAccount,
            paymentTransactions,
        });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
};
