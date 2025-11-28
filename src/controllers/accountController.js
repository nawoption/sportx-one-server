const Account = require("../models/accountModel");
const LimitSetting = require("../models/limitSettingModel");
const CommissionSetting = require("../models/commissionSettingModel");
const Balance = require("../models/balanceModel");

const { hashPassword } = require("../utils/helper");

// Allowed parent → child roles
const allowedUpline = {
    Admin: ["Super", "Senior", "Master", "Agent", "User"],
    Super: ["Senior", "Master", "Agent", "User"],
    Senior: ["Master", "Agent", "User"],
    Master: ["Agent", "User"],
    Agent: ["User"],
};

module.exports = {
    // REGISTER (used by Admin/Super/Senior/Master/Agent)
    createAccount: async (req, res) => {
        try {
            const { username, password, contact, role, upline, limit, commission } = req.body;
            // Check role permissions
            if (!allowedUpline[req.user.role]?.includes(role)) {
                return res.status(403).json({
                    message: `You cannot create ${role}`,
                });
            }
            // Check if username already exists
            const exists = await Account.findOne({ username: req.user.username + username });
            if (exists) {
                return res.status(400).json({ message: "Username already exists" });
            }

            const limitSetting = new LimitSetting({ ...limit, createdBy: req.user._id });
            await limitSetting.save();

            const commissionSetting = new CommissionSetting({ ...commission, createdBy: req.user._id });
            await commissionSetting.save();

            const hashedPassword = await hashPassword(password);

            //  Create account
            const newAccount = await Account.create({
                username: req.user.username + username,
                password: hashedPassword,
                contact,
                role,
                upline: upline || req.user._id,
                limitSetting,
                commissionSetting,
            });

            //  Update upline downlines
            const parent = await Account.findById(upline || req.user._id);
            parent.downlines.push(newAccount._id);
            await parent.save();

            // Create balance
            await Balance.create({ account: newAccount._id });

            res.json({
                message: "Account created successfully",
                user: newAccount,
            });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    },

    getAccountById: async (req, res) => {
        try {
            const { id } = req.params;

            const account = await Account.findById(id)
                .populate("limitSetting commissionSetting")
                .select("-password")
                .lean();
            if (!account) return res.status(404).json({ message: "Account not found" });
            res.json(account);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    },

    getAccountsByRole: async (req, res) => {
        try {
            const { role } = req.params;
            let { page, limit, search } = req.query;

            page = parseInt(page) || 1;
            limit = parseInt(limit) || 10;
            const skip = (page - 1) * limit;
            let query = { isDeleted: false, isSubAccount: false };
            if (search) {
                query.username = { $regex: search, $options: "i" };
            }

            const total = await Account.countDocuments({ role, ...query });

            const accounts = await Account.find({ role, ...query })
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .select("-password")
                .lean();
            // fetch balance accounts for each user
            for (let i = 0; i < accounts.length; i++) {
                const balanceAccount = await Balance.findOne({ account: accounts[i]._id })
                    .select("-_id cashBalance accountBalance commissionBalance")
                    .lean();
                accounts[i].balanceAccount = balanceAccount;
            }
            res.json({
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                users: accounts,
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    },

    // RESET PASSWORD
    resetPassword: async (req, res) => {
        try {
            const { id } = req.params;
            const { newPassword } = req.body;

            const acc = await Account.findById(id);
            if (!acc) return res.status(404).json({ message: "Account not found" });

            acc.password = await hashPassword(newPassword);
            acc.isChangePassword = false;
            await acc.save();

            return res.json({ message: "Password reset successfully" });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    // BAN / UNBAN USER
    updateStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const acc = await Account.findById(id);
            if (!acc) return res.status(404).json({ message: "Account not found" });

            acc.status = status;
            await acc.save();

            return res.json({ message: "Status updated", account: acc });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    // UPDATE PROFILE
    updateProfile: async (req, res) => {
        try {
            const { id } = req.params;
            const { contact, limit, commission } = req.body;

            const acc = await Account.findById(id);
            if (!acc) return res.status(404).json({ message: "Account not found" });

            // Update limit settings if provided
            if (limit) {
                const limitSetting = await LimitSetting.findById(acc.limitSetting);
                if (limitSetting) {
                    Object.assign(limitSetting, limit);
                    await limitSetting.save();
                }
            }

            // Update commission settings if provided
            if (commission) {
                const commissionSetting = await CommissionSetting.findById(acc.commissionSetting);
                if (commissionSetting) {
                    Object.assign(commissionSetting, commission);
                    await commissionSetting.save();
                }
            }

            acc.contact = contact || acc.contact;
            await acc.save();

            return res.json({ message: "Profile updated", user: acc });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    // SOFT DELETE
    softDelete: async (req, res) => {
        const acc = await Account.findById(req.params.id);
        if (!acc) return res.status(404).json({ message: "Account not found" });

        acc.isDeleted = true;
        await acc.save();

        res.json({ success: true, message: "Account soft deleted" });
    },
};
