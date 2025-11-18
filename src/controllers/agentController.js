const Agent = require("../models/agentModel");
const LimitSetting = require("../models/limitSettingModel");
const CommissionSetting = require("../models/commissionSettingModel");
const {
    comparePassword,
    hashPassword,
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
} = require("../utils/helper");

const agentController = {
    // ------------------- (FOR agent) -------------------
    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            const agent = await Agent.findOne({ username, isDeleted: false, status: "ACTIVE" })
                .populate("commissionSetting")
                .populate("limitSetting");
            if (!agent) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            if (agent.status !== "ACTIVE") {
                return res.status(403).json({ message: "agent is not active" });
            }

            // Check password
            const isMatch = await comparePassword(password, agent.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Invalid username or password" });
            }

            // Generate JWT tokens
            const accessToken = generateAccessToken({ id: agent._id });
            const refreshToken = generateRefreshToken({ id: agent._id });
            const token = { accessToken, refreshToken };

            res.status(200).json({
                message: "Login successful",
                token,
                agent: { ...agent.toObject(), password: undefined },
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    getProfile: async (req, res) => {
        try {
            const id = req.params.id || req.agent._id;

            const agent = await Agent.findById(id)
                .populate("limitSetting")
                .populate("commissionSetting")
                .select("-password");

            if (!agent) {
                return res.status(404).json({ message: "agent not found" });
            }

            res.status(200).json(agent);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error" });
        }
    },

    changePassword: async (req, res) => {
        try {
            const id = req.params.id || req.agent._id;
            const { oldPassword, newPassword } = req.body;

            const agent = await Agent.findById(id);
            if (!agent) {
                return res.status(404).json({ message: "agent not found" });
            }

            // Check old password
            const isMatch = await comparePassword(oldPassword, agent.password);
            if (!isMatch) {
                return res.status(400).json({ message: "Old password is incorrect" });
            }

            // Hash new password
            agent.password = await hashPassword(newPassword);
            await agent.save();

            res.status(200).json({ message: "Password changed successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    verifyToken: async (req, res) => {
        try {
            const agentId = req.agent.id;
            const agent = await Agent.findById(agentId).select("-password");
            if (!agent) {
                return res.status(404).json({ message: "agent not found" });
            }
            res.status(200).json({ valid: true, agent });
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

            const agent = await Agent.findById(decoded.id).select("-password");
            if (!agent) {
                return res.status(404).json({ valid: false, message: "agent not found" });
            }
            const accessToken = generateAccessToken({ id: decoded.id });
            const newRefreshToken = generateRefreshToken({ id: decoded.id });
            const token = { accessToken, refreshToken: newRefreshToken };

            res.status(200).json({ token, agent });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    // ------------------- (FOR SENIOR | MASTER ) -------------------

    register: async (req, res) => {
        try {
            const { username, password, limit, commission } = req.body;

            // Determine who is creating this user
            const actor = req.admin || req.senior || req.master;
            if (!actor) return res.status(403).json({ message: "unauthorized" });
            const createdBy = actor._id;
            const createdByModel = req.admin ? "Admin" : req.senior ? "Senior" : req.master ? "Master" : null;

            // Check if username already exists
            const existingagent = await Agent.findOne({ username });
            if (existingagent) {
                return res.status(400).json({ message: "Username already exists" });
            }

            const limitSetting = new LimitSetting({ ...limit, createdBy });
            await limitSetting.save();

            const commissionSetting = new CommissionSetting({ ...commission, createdBy });
            await commissionSetting.save();

            const hashedPassword = await hashPassword(password);

            const newagent = new Agent({
                username,
                password: hashedPassword,
                limitSetting: limitSetting._id,
                commissionSetting: commissionSetting._id,
                senior: req.senior ? req.senior._id : null,
                master: req.master ? req.master._id : null,
                createdBy,
                createdByModel,
            });

            await newagent.save();

            res.status(201).json({ message: "agent registered successfully" });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: error.message });
        }
    },

    getAllAgents: async (req, res) => {
        try {
            let { page, limit, search, status } = req.query;

            page = parseInt(page) || 1;
            limit = parseInt(limit) || 10;
            const skip = (page - 1) * limit;

            // build query
            let query = {};
            if (req.admin) {
                query.isDeleted = false;
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

            const total = await Agent.countDocuments(query);
            const agents = await Agent.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }).select("-password");

            res.status(200).json({
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                agents,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: error.message });
        }
    },

    updateProfile: async (req, res) => {
        try {
            const id = req.params.id || req.agent._id;
            const { limit, commission } = req.body;

            const agent = await Agent.findById(id);
            if (!agent) {
                return res.status(404).json({ message: "agent not found" });
            }

            // Update limit setting
            await LimitSetting.findByIdAndUpdate(agent.limitSetting, limit, { new: true });

            // Update commission setting
            await CommissionSetting.findByIdAndUpdate(agent.commissionSetting, commission, { new: true });

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
            const agent = await Agent.findByIdAndUpdate(id, { status }, { new: true });
            if (!agent) {
                return res.status(404).json({ message: "agent not found" });
            }

            res.status(200).json({ message: "agent status updated successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    resetPassword: async (req, res) => {
        try {
            const { id } = req.params;
            const newPassword = req.body.newPassword || "defaultPassword123";

            const agent = await Agent.findById(id);
            if (!agent) {
                return res.status(404).json({ message: "agent not found" });
            }

            agent.password = await hashPassword(newPassword);
            await agent.save();

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

            const deletedagent = await Agent.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
            if (!deletedagent) {
                return res.status(404).json({ message: "agent not found" });
            }

            res.status(200).json({ message: "agent deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },
};

module.exports = agentController;
