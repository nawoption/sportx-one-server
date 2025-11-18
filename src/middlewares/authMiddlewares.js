const Admin = require("../models/adminModel");
const Senior = require("../models/seniorModel");
const Master = require("../models/masterModel");
const Agent = require("../models/agentModel");
const User = require("../models/userModel");

const { verifyToken } = require("../utils/helper");

// Verify token and attach admin to request
const adminAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = verifyToken(token);

            req.admin = await Admin.findById(decoded.id).select("-password");

            if (!req.admin) {
                return res.status(401).json({ message: "Admin not found" });
            }

            next();
        } catch (error) {
            return res.status(401).json({ message: error.message });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
};

const seniorAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = verifyToken(token);

            req.senior = await Senior.findById(decoded.id).select("-password");

            if (!req.senior) {
                return res.status(401).json({ message: "Senior not found" });
            }

            next();
        } catch (error) {
            return res.status(401).json({ message: error.message });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
};

const masterAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = verifyToken(token);

            req.master = await Master.findById(decoded.id).select("-password");

            if (!req.master) {
                return res.status(401).json({ message: "Master not found" });
            }

            next();
        } catch (error) {
            return res.status(401).json({ message: error.message });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
};

const agentAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = verifyToken(token);

            req.agent = await Agent.findById(decoded.id).select("-password");

            if (!req.agent) {
                return res.status(401).json({ message: "Agent not found" });
            }

            next();
        } catch (error) {
            return res.status(401).json({ message: error.message });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
};

const userAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = verifyToken(token);

            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) {
                return res.status(401).json({ message: "Master not found" });
            }

            next();
        } catch (error) {
            return res.status(401).json({ message: error.message });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
};

// Helper to determine who is making the request
const getActor = (req) => {
    if (req.admin) return { type: "Admin", id: req.admin._id };
    if (req.senior) return { type: "Senior", id: req.senior._id };
    if (req.master) return { type: "Master", id: req.master._id };
    if (req.agent) return { type: "Agent", id: req.agent._id };
    if (req.user) return { type: "User", id: req.user._id };
    return null;
};

/**
 * canEditUser middleware
 * - Admin: can edit any user
 * - Senior/Master/Agent: can edit only users they created (createdBy + createdByModel must match)
 * - User: can edit only their own profile
 */
const canEditUser = async (req, res, next) => {
    try {
        const actor = getActor(req);
        if (!actor) return res.status(401).json({ message: "Not authorized" });

        const targetUserId = req.params.id || (req.user && req.user._id);
        if (!targetUserId) return res.status(400).json({ message: "Target user id is required" });

        // Admins can edit any user
        if (actor.type === "Admin") return next();

        // If the actor is the user themself
        if (actor.type === "User") {
            if (String(actor.id) === String(targetUserId)) return next();
            return res.status(403).json({ message: "Forbidden: can only edit your own profile" });
        }

        // For Senior/Master/Agent: only allow if they created the target user
        const user = await User.findById(targetUserId).select("createdBy createdByModel");
        if (!user) return res.status(404).json({ message: "user not found" });

        if (String(user.createdBy) === String(actor.id) && user.createdByModel === actor.type) {
            return next();
        }

        return res.status(403).json({ message: "Forbidden: you can only edit users you created" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const canEditAgent = async (req, res, next) => {
    try {
        const actor = getActor(req);
        if (!actor) return res.status(401).json({ message: "Not authorized" });

        const targetAgentId = req.params.id || (req.agent && req.agent._id);
        if (!targetAgentId) return res.status(400).json({ message: "Target agent id is required" });

        // Admins can edit any agent
        if (actor.type === "Admin") return next();

        // If the actor is the agent themself
        if (actor.type === "Agent") {
            if (String(actor.id) === String(targetAgentId)) return next();
            return res.status(403).json({ message: "Forbidden: can only edit your own profile" });
        }

        // For Senior/Master: only allow if they created the target agent
        const agent = await Agent.findById(targetAgentId).select("createdBy createdByModel");
        if (!agent) return res.status(404).json({ message: "Agent not found" });

        if (String(agent.createdBy) === String(actor.id) && agent.createdByModel === actor.type) {
            return next();
        }

        return res.status(403).json({ message: "Forbidden: you can only edit agents you created" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Generic role checker to be used after a specific auth middleware has run
const requireRole =
    (allowedTypes = []) =>
    (req, res, next) => {
        const actor = getActor(req);
        if (!actor) return res.status(401).json({ message: "Not authorized" });
        if (allowedTypes.includes(actor.type)) return next();
        return res.status(403).json({ message: "Forbidden: insufficient role" });
    };

module.exports = { adminAuth, seniorAuth, masterAuth, agentAuth, userAuth, canEditUser, canEditAgent, requireRole };
