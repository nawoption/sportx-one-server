const Master = require("../models/masterModel");
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

const masterController = {
    // ------------------- (FOR MASTER) -------------------
    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            const master = await Master.findOne({ username, isDeleted: false, status: "ACTIVE" })
                .populate("commissionSetting")
                .populate("limitSetting");
            if (!master) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            if (master.status !== "ACTIVE") {
                return res.status(403).json({ message: "master is not active" });
            }

            // Check password
            const isMatch = await comparePassword(password, master.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            // Generate JWT tokens
            const accessToken = generateAccessToken({ id: master._id });
            const refreshToken = generateRefreshToken({ id: master._id });
            const token = { accessToken, refreshToken };

            //
            const balanceAccount = await BalanceAccount.findOne({ owner: master._id, ownerModel: "Master" });

            res.status(200).json({
                message: "Login successful",
                token,
                user: { ...master.toObject(), password: undefined },
                balanceAccount,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    getProfile: async (req, res) => {
        try {
            const id = req.params.id || req.master._id;

            const master = await Master.findById(id)
                .populate("limitSetting")
                .populate("commissionSetting")
                .select("-password");

            if (!master) {
                return res.status(404).json({ message: "master not found" });
            }

            const balanceAccount = await BalanceAccount.findOne({ owner: master._id, ownerModel: "Master" });

            res.status(200).json({ master, balanceAccount });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    changePassword: async (req, res) => {
        try {
            const id = req.params.id || req.master._id;
            const { oldPassword, newPassword } = req.body;

            const master = await Master.findById(id);
            if (!master) {
                return res.status(404).json({ message: "master not found" });
            }

            // Check old password
            const isMatch = await comparePassword(oldPassword, master.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Old password is incorrect" });
            }

            // Hash new password
            master.password = await hashPassword(newPassword);
            await master.save();

            res.status(200).json({ message: "Password changed successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    verifyToken: async (req, res) => {
        try {
            const masterId = req.master.id;
            const master = await Master.findById(masterId).select("-password");
            if (!master) {
                return res.status(404).json({ message: "master not found" });
            }
            res.status(200).json({ valid: true, master });
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

            const master = await Master.findById(decoded.id).select("-password");
            if (!master) {
                return res.status(404).json({ valid: false, message: "master not found" });
            }
            const accessToken = generateAccessToken({ id: decoded.id });
            const newRefreshToken = generateRefreshToken({ id: decoded.id });
            const token = { accessToken, refreshToken: newRefreshToken };

            res.status(200).json({ token, master });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    // ------------------- (FOR SENIOR) -------------------

    register: async (req, res) => {
        try {
            const { username, password, limit, commission } = req.body;

            // Determine who is creating this user
            const actor = req.admin || req.senior;
            if (!actor) return res.status(403).json({ message: "unauthorized" });
            const createdBy = actor._id;
            const createdByModel = req.admin ? "Admin" : req.senior ? "Senior" : null;

            // Check if username already exists
            const existingMaster = await Master.findOne({ username });
            if (existingMaster) {
                return res.status(400).json({ message: "Username already exists" });
            }

            const limitSetting = new LimitSetting({ ...limit, createdBy });
            await limitSetting.save();

            const commissionSetting = new CommissionSetting({ ...commission, createdBy });
            await commissionSetting.save();

            const hashedPassword = await hashPassword(password);

            const newMaster = new Master({
                username,
                password: hashedPassword,
                limitSetting: limitSetting._id,
                commissionSetting: commissionSetting._id,
                senior: req.senior ? req.senior._id : null,
                createdBy,
                createdByModel,
            });

            await newMaster.save();

            // Create BalanceAccount for the new Master
            await new BalanceAccount({
                owner: newMaster._id,
                ownerModel: "Master",
            }).save();

            res.status(201).json({ message: "master registered successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    getAllMasters: async (req, res) => {
        try {
            let { page, limit, search, status } = req.query;

            page = parseInt(page) || 1;
            limit = parseInt(limit) || 10;
            const skip = (page - 1) * limit;

            // build query
            let query = {};
            if (req.admin) {
                // Admin can see all masters
                query.isDeleted = false;
            } else if (req.senior) {
                // Senior can see only their created masters
                query = { createdBy: req.senior._id, createdByModel: "Senior", isDeleted: false };
            }

            if (search) {
                query.username = { $regex: search, $options: "i" };
            }
            if (status) query.status = status;

            const total = await Master.countDocuments(query);
            const masters = await Master.find(query)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 })
                .select("-password");

            // fetch balance accounts for each master
            for (let i = 0; i < masters.length; i++) {
                const balanceAccount = await BalanceAccount.findOne({ owner: masters[i]._id, ownerModel: "Master" });
                masters[i] = masters[i].toObject();
                masters[i].balanceAccount = balanceAccount;
            }

            res.status(200).json({
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                masters,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    updateProfile: async (req, res) => {
        try {
            const id = req.params.id || req.master._id;
            const { limit, commission } = req.body;

            const master = await Master.findById(id);
            if (!master) {
                return res.status(404).json({ message: "Master not found" });
            }

            // Update limit setting
            await LimitSetting.findByIdAndUpdate(master.limitSetting, limit, { new: true });

            // Update commission setting
            await CommissionSetting.findByIdAndUpdate(master.commissionSetting, commission, { new: true });

            res.status(200).json({ message: "Profile updated successfully", master });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    updateStatus: async (req, res) => {
        const { id } = req.params;
        const status = req.body.status;
        try {
            const master = await Master.findByIdAndUpdate(id, { status }, { new: true });
            if (!master) {
                return res.status(404).json({ message: "master not found" });
            }

            res.status(200).json({ message: "master status updated successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    resetPassword: async (req, res) => {
        try {
            const { id } = req.params;
            const newPassword = req.body.newPassword || "defaultPassword123";

            const master = await Master.findById(id);
            if (!master) {
                return res.status(404).json({ message: "master not found" });
            }

            master.password = await hashPassword(newPassword);
            await master.save();

            res.status(200).json({ message: "Password reset successfully", master });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    // ------------------- (FOR ADMIN) -------------------

    deleteProfile: async (req, res) => {
        try {
            const { id } = req.params;

            const deletedmaster = await Master.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
            if (!deletedmaster) {
                return res.status(404).json({ message: "master not found" });
            }

            res.status(200).json({ message: "master deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
};

module.exports = masterController;
