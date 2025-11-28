const Account = require("../models/accountModel");
const { comparePassword, generateAccessToken, hashPassword } = require("../utils/helper");

module.exports = {
    // CREATE SUB-ACCOUNT
    createSubAccount: async (req, res) => {
        try {
            const { username, password, permissions, contact } = req.body;
            const exist = await Account.findOne({ username: req.user.username + username });
            if (exist) {
                return res.status(400).json({ message: "Sub-account username already exists" });
            }

            const hashed = await hashPassword(password);

            const sub = await Account.create({
                username: req.user.username + username,
                password: hashed,
                role: req.user.role,
                contact,
                upline: req.user.upline,
                limitSetting: req.user.limitSetting,
                commissionSetting: req.user.commissionSetting,
                isSubAccount: true,
                parentAccount: req.user._id,
                permissions: permissions || ["VIEW_ONLY"],
            });

            res.json({
                message: "Sub-account created",
                subAccount: sub,
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    },

    // LOGIN
    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            const account = await Account.findOne({ username });
            if (!account) {
                return res.status(400).json({ message: "Invalid credentials" });
            }

            const isMatch = await comparePassword(password, account.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Invalid credentials" });
            }

            const token = generateAccessToken({ id: account._id, role: account.role });

            return res.json({
                message: "Login successful",
                token,
                user: { ...account.toObject(), password: undefined },
            });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },

    // GET OWN PROFILE
    getProfile: async (req, res) => {
        const user = await Account.findById(req.user._id)
            .populate("limitSetting commissionSetting")
            .select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.json(user);
    },

    // CHANGE PASSWORD
    changePassword: async (req, res) => {
        try {
            const { oldPassword, newPassword } = req.body;

            const account = await Account.findById(req.user._id);
            if (!account) return res.status(404).json({ message: "Account not found" });

            const isMatch = await comparePassword(oldPassword, account.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Old password is incorrect" });
            }

            account.password = await hashPassword(newPassword);
            account.isChangePassword = true;
            await account.save();

            return res.json({ message: "Password changed successfully" });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    },
};
