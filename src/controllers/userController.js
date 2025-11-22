const User = require("../models/userModel");
const LimitSetting = require("../models/limitSettingModel");
const CommissionSetting = require("../models/commissionSettingModel");
const BalanceAccount = require("../models/balanceAccountModel");

const {
    comparePassword,
    hashPassword,
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
} = require("../utils/helper");

const userController = {
    // ------------------- (FOR user) -------------------
    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            const user = await User.findOne({ username, isDeleted: false, status: "ACTIVE" }).populate("limitSetting");
            if (!user) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            if (user.status !== "ACTIVE") {
                return res.status(403).json({ message: "user is not active" });
            }

            // Check password
            const isMatch = await comparePassword(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            // Generate JWT tokens
            const accessToken = generateAccessToken({ id: user._id });
            const refreshToken = generateRefreshToken({ id: user._id });
            const token = { accessToken, refreshToken };

            // Balance Account fetch
            const balanceAccount = await BalanceAccount.findOne({ owner: user._id, ownerModel: "User" });

            res.status(200).json({
                message: "Login successful",
                token,
                user: { ...user.toObject(), password: undefined },
                balanceAccount,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    getProfile: async (req, res) => {
        try {
            const id = req.params.id || req.user._id;

            const user = await User.findById(id).populate("limitSetting").select("-password");

            if (!user) {
                return res.status(404).json({ message: "user not found" });
            }

            const balanceAccount = await BalanceAccount.findOne({ owner: user._id, ownerModel: "User" });

            res.status(200).json({ user, balanceAccount });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    changePassword: async (req, res) => {
        try {
            const id = req.params.id || req.user._id;
            const { oldPassword, newPassword } = req.body;

            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ message: "user not found" });
            }

            // Check old password
            const isMatch = await comparePassword(oldPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Old password is incorrect" });
            }

            // Hash new password
            user.password = await hashPassword(newPassword);
            await user.save();

            res.status(200).json({ message: "Password changed successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    verifyToken: async (req, res) => {
        try {
            const userId = req.user.id;
            const user = await User.findById(userId).select("-password");
            if (!user) {
                return res.status(404).json({ message: "user not found" });
            }
            res.status(200).json({ valid: true, user });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    generateAccessToken: async (req, res) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({ message: "Refresh token is required" });
            }

            // verify token
            const decoded = verifyToken(refreshToken);
            if (!decoded) {
                return res.status(401).json({ valid: false, message: "Invalid token" });
            }

            const user = await User.findById(decoded.id).select("-password");
            if (!user) {
                return res.status(404).json({ valid: false, message: "user not found" });
            }
            const accessToken = generateAccessToken({ id: decoded.id });
            const newRefreshToken = generateRefreshToken({ id: decoded.id });
            const token = { accessToken, refreshToken: newRefreshToken };

            res.status(200).json({ token, user });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    // ------------------- (FOR ADMIN | SENIOR | MASTER | AGENT ) -------------------

    register: async (req, res) => {
        try {
            const { username, password, limit } = req.body;

            // Determine who is creating this user
            const actor = req.admin || req.senior || req.master || req.agent;
            if (!actor) return res.status(403).json({ message: "unauthorized" });
            const createdBy = actor._id;
            const createdByModel = req.admin ? "Admin" : req.senior ? "Senior" : req.master ? "Master" : "Agent";

            // Check if username already exists
            const existinguser = await User.findOne({ username });
            if (existinguser) {
                return res.status(400).json({ message: "Username already exists" });
            }

            const limitSetting = new LimitSetting({ ...limit, createdBy });
            await limitSetting.save();

            const hashedPassword = await hashPassword(password);

            const newUser = new User({
                username,
                password: hashedPassword,
                limitSetting: limitSetting._id,
                senior: req.senior ? req.senior._id : null,
                master: req.master ? req.master._id : null,
                agent: req.agent ? req.agent._id : null,
                createdBy,
                createdByModel,
            });

            await newUser.save();

            // Create BalanceAccount for the new user
            const balanceAccount = new BalanceAccount({
                owner: newUser._id,
                ownerModel: "User",
            });
            await balanceAccount.save();

            res.status(201).json({
                message: "user registered successfully",
                newuser: { ...newUser.toObject(), password: undefined },
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: error.message });
        }
    },

    getAllUsers: async (req, res) => {
        try {
            let { page, limit, search, status } = req.query;

            page = parseInt(page) || 1;
            limit = parseInt(limit) || 10;
            const skip = (page - 1) * limit;

            // build query
            let query = {};
            if (req.admin) {
                // Admin can see all users
                query = { isDeleted: false };
            } else {
                const actor = req.senior || req.master || req.agent;
                const actorType = req.senior ? "Senior" : req.master ? "Master" : "Agent";
                query = {
                    isDeleted: false,
                    createdBy: actor._id,
                    createdByModel: actorType,
                };
            }
            if (search) {
                query.username = { $regex: search, $options: "i" };
            }
            if (status) query.status = status;

            const total = await User.countDocuments(query);
            const users = await User.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).select("-password");

            // fetch balance accounts for each agent
            for (let i = 0; i < users.length; i++) {
                const balanceAccount = await BalanceAccount.findOne({ owner: users[i]._id, ownerModel: "User" });
                users[i] = users[i].toObject();
                users[i].balanceAccount = balanceAccount;
            }

            res.status(200).json({
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                users,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    updateProfile: async (req, res) => {
        try {
            const id = req.params.id || req.user._id;
            const { limit, commission } = req.body;

            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ message: "user not found" });
            }

            // Update limit setting
            await LimitSetting.findByIdAndUpdate(user.limitSetting, limit, { new: true });

            // Update commission setting
            await CommissionSetting.findByIdAndUpdate(user.commissionSetting, commission, { new: true });

            res.status(200).json({ message: "Profile updated successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    updateStatus: async (req, res) => {
        const { id } = req.params;
        const status = req.body.status;
        try {
            const user = await User.findByIdAndUpdate(id, { status }, { new: true });
            if (!user) {
                return res.status(404).json({ message: "user not found" });
            }

            res.status(200).json({ message: "user status updated successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    resetPassword: async (req, res) => {
        try {
            const { id } = req.params;
            const newPassword = req.body.newPassword || "defaultPassword123";

            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ message: "user not found" });
            }

            user.password = await hashPassword(newPassword);
            await user.save();

            res.status(200).json({ message: "Password reset successfully" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // ------------------- (FOR ADMIN) -------------------

    deleteProfile: async (req, res) => {
        try {
            const { id } = req.params;

            const deleteduser = await User.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
            if (!deleteduser) {
                return res.status(404).json({ message: "user not found" });
            }

            res.status(200).json({ message: "User deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
};

module.exports = userController;
