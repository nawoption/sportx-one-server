const Admin = require("../models/adminModel");
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
            console.error(error);
            return res.status(401).json({ message: error.message });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
};

module.exports = { adminAuth };
