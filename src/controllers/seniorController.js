const Senior = require("../models/seniorModel");
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

const seniorController = {
    // ------------------- (FOR Senior) -------------------
    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            const senior = await Senior.findOne({ username, isDeleted: false, status: "ACTIVE" })
                .populate("commissionSetting")
                .populate("limitSetting");
            if (!senior) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            if (senior.status !== "ACTIVE") {
                return res.status(403).json({ message: "senior is not active" });
            }

            // Check password
            const isMatch = await comparePassword(password, senior.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            // Generate JWT tokens
            const accessToken = generateAccessToken({ id: senior._id });
            const refreshToken = generateRefreshToken({ id: senior._id });
            const token = { accessToken, refreshToken };

            // Back to client
            const balanceAccount = await BalanceAccount.findOne({ owner: senior._id, ownerModel: "Senior" });

            res.status(200).json({
                message: "Login successful",
                token,
                user: { ...senior.toObject(), password: undefined },
                balanceAccount,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    getProfile: async (req, res) => {
        try {
            const id = req.params.id || req.senior._id;

            const senior = await Senior.findById(id)
                .populate("limitSetting")
                .populate("commissionSetting")
                .select("-password");

            if (!senior) {
                return res.status(404).json({ message: "senior not found" });
            }

            const balanceAccount = await BalanceAccount.findOne({ owner: senior._id, ownerModel: "Senior" });

            res.status(200).json({ senior, balanceAccount });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    changePassword: async (req, res) => {
        try {
            const id = req.params.id || req.senior._id;
            const { oldPassword, newPassword } = req.body;

            const senior = await Senior.findById(id);
            if (!senior) {
                return res.status(404).json({ message: "senior not found" });
            }

            // Check old password
            const isMatch = await comparePassword(oldPassword, senior.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Old password is incorrect" });
            }

            // Hash new password
            senior.password = await hashPassword(newPassword);
            await senior.save();

            res.status(200).json({ message: "Password changed successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    verifyToken: async (req, res) => {
        try {
            const seniorId = req.senior.id;
            const senior = await Senior.findById(seniorId).select("-password");
            if (!senior) {
                return res.status(404).json({ message: "senior not found" });
            }
            res.status(200).json({ valid: true, senior });
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

            const senior = await Senior.findById(decoded.id).select("-password");
            if (!senior) {
                return res.status(404).json({ valid: false, message: "senior not found" });
            }
            const accessToken = generateAccessToken({ id: decoded.id });
            const newRefreshToken = generateRefreshToken({ id: decoded.id });
            const token = { accessToken, refreshToken: newRefreshToken };

            res.status(200).json({ token, senior });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    // ------------------- (FOR ADMIN) -------------------

    register: async (req, res) => {
        try {
            const { username, password, limit, commission } = req.body;

            const existingSenior = await Senior.findOne({ username });
            if (existingSenior) {
                return res.status(400).json({ message: "Username already exists" });
            }

            const limitSetting = new LimitSetting({ ...limit, createdBy: req.admin._id });
            await limitSetting.save();

            const commissionSetting = new CommissionSetting({ ...commission, createdBy: req.admin._id });
            await commissionSetting.save();

            const newSenior = new Senior({
                username,
                password: await hashPassword(password),
                limitSetting: limitSetting._id,
                commissionSetting: commissionSetting._id,
                createdBy: req.admin._id,
            });
            await newSenior.save();

            await new BalanceAccount({
                ownerModel: "Senior",
                owner: newSenior._id,
            }).save();

            res.status(201).json({ message: "Senior senior registered successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    getAllSeniors: async (req, res) => {
        try {
            let { page, limit, search, status } = req.query;

            page = parseInt(page) || 1;
            limit = parseInt(limit) || 10;
            const skip = (page - 1) * limit;

            // build query
            let query = {};
            if (search) {
                query.username = { $regex: search, $options: "i" };
            }
            if (status) query.status = status;

            const total = await Senior.countDocuments(query);
            const seniors = await Senior.find(query)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .select("-password");

            // fetch balance accounts for each senior
            for (let i = 0; i < seniors.length; i++) {
                const balanceAccount = await BalanceAccount.findOne({ owner: seniors[i]._id, ownerModel: "Senior" });
                seniors[i] = seniors[i].toObject();
                seniors[i].balanceAccount = balanceAccount;
            }

            res.status(200).json({
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                seniors,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    updateProfile: async (req, res) => {
        try {
            const id = req.params.id || req.senior._id;
            const { limit, commission } = req.body;

            const senior = await Senior.findById(id);
            if (!senior) {
                return res.status(404).json({ message: "senior not found" });
            }

            // Update limit setting
            await LimitSetting.findByIdAndUpdate(senior.limitSetting, limit, { new: true });

            // Update commission setting
            await CommissionSetting.findByIdAndUpdate(senior.commissionSetting, commission, { new: true });

            res.status(200).json({ message: "Profile updated successfully", senior });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    updateStatus: async (req, res) => {
        const { id } = req.params;
        const status = req.body.status;
        try {
            const senior = await Senior.findByIdAndUpdate(id, { status }, { new: true });
            if (!senior) {
                return res.status(404).json({ message: "Senior not found" });
            }

            res.status(200).json({ message: "Senior status updated successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    resetPassword: async (req, res) => {
        try {
            const { id } = req.params;
            const newPassword = req.body.newPassword || "defaultPassword123";

            const senior = await Senior.findById(id);
            if (!senior) {
                return res.status(404).json({ message: "senior not found" });
            }

            senior.password = await hashPassword(newPassword);
            await senior.save();

            res.status(200).json({ message: "Password reset successfully", senior });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    deleteProfile: async (req, res) => {
        try {
            const { id } = req.params;

            const deletedsenior = await Senior.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
            if (!deletedsenior) {
                return res.status(404).json({ message: "senior not found" });
            }

            res.status(200).json({ message: "senior deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
};

module.exports = seniorController;
